import type { User as ClerkUser } from "@clerk/backend";
import { createClerkClient } from "@clerk/backend";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod/v4";

import type { UserRole } from "@acme/db";
import { db } from "@acme/db";
import { VIEWER_HEADER_NAME, defaultDemoProfiles } from "@acme/validators";

interface ClerkIdentity {
  email: string | null;
  firstName: string | null;
  fullName: string | null;
  isAuthenticated: boolean;
  lastName: string | null;
  role: UserRole;
  userId: string | null;
}

const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const clerkClient =
  clerkSecretKey && clerkPublishableKey
    ? createClerkClient({
        apiUrl: process.env.CLERK_API_URL,
        publishableKey: clerkPublishableKey,
        secretKey: clerkSecretKey,
      })
    : null;
const configuredClerkRequestTimeoutMs = Number.parseInt(
  process.env.WORKFORCE_CLERK_TIMEOUT_MS ?? "",
  10,
);
const clerkRequestTimeoutMs = Number.isFinite(configuredClerkRequestTimeoutMs)
  ? Math.max(configuredClerkRequestTimeoutMs, 1_000)
  : 4_000;
const demoProfilesByEmail = new Map(
  defaultDemoProfiles.map((profile) => [profile.email.toLowerCase(), profile]),
);

const createAnonymousIdentity = () =>
  ({
    email: null,
    firstName: null,
    fullName: null,
    isAuthenticated: false,
    lastName: null,
    role: "EMPLOYEE",
    userId: null,
  }) satisfies ClerkIdentity;

const withClerkTimeout = <T>(promise: Promise<T>, label: string) =>
  new Promise<T>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out after ${clerkRequestTimeoutMs}ms`));
    }, clerkRequestTimeoutMs);

    void promise.then(
      (value) => {
        clearTimeout(timeoutHandle);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeoutHandle);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });

const toTitleCase = (value: string) =>
  value.replace(/\b\w/g, (token) => token.toUpperCase());

const toFallbackNameFromEmail = (email: string) => {
  const localPart = email.split("@")[0] ?? "workforce member";
  return toTitleCase(localPart.replace(/[._-]+/g, " ").trim());
};

const toHeaderViewerIdentity = (email: string): ClerkIdentity => {
  const normalizedEmail = email.toLowerCase();
  const demoProfile = demoProfilesByEmail.get(normalizedEmail);
  const resolvedName =
    demoProfile?.name ?? toFallbackNameFromEmail(normalizedEmail);
  const tokens = resolvedName.split(/\s+/).filter(Boolean);
  const firstName = tokens[0] ?? null;
  const lastName = tokens.slice(1).join(" ") || null;

  return {
    email: normalizedEmail,
    firstName,
    fullName: resolvedName,
    isAuthenticated: true,
    lastName,
    role: demoProfile?.role ?? "EMPLOYEE",
    userId: `demo:${normalizedEmail}`,
  } satisfies ClerkIdentity;
};

const resolveViewerEmailHeader = (headers: Headers) => {
  const headerValue = headers.get(VIEWER_HEADER_NAME);
  if (!headerValue) {
    return null;
  }

  const normalized = headerValue.trim().toLowerCase();
  return normalized.includes("@") ? normalized : null;
};

const getPrimaryEmailAddress = (user: ClerkUser) => {
  const primaryEmail = user.emailAddresses.find(
    (emailAddress) => emailAddress.id === user.primaryEmailAddressId,
  );

  return (
    primaryEmail?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null
  );
};

const validRoles = new Set<UserRole>(["EMPLOYEE", "MANAGER", "ADMIN"]);

const normalizeRole = (role: unknown): UserRole | null => {
  if (typeof role !== "string") {
    return null;
  }

  const normalized = role.trim().toUpperCase();
  return validRoles.has(normalized as UserRole)
    ? (normalized as UserRole)
    : null;
};

const resolveClerkRole = (user: ClerkUser): UserRole => {
  const roleFromPrivateMetadata = normalizeRole(
    (user.privateMetadata as Record<string, unknown> | null | undefined)?.role,
  );

  return roleFromPrivateMetadata ?? "EMPLOYEE";
};

const getDisplayName = (identity: ClerkIdentity) => {
  if (identity.fullName?.trim()) {
    return identity.fullName.trim();
  }

  const combinedName = `${identity.firstName ?? ""} ${identity.lastName ?? ""}`
    .trim()
    .replace(/\s+/g, " ");

  if (combinedName) {
    return combinedName;
  }

  if (identity.email) {
    return identity.email.split("@")[0]?.replace(/[._-]+/g, " ") ?? "Worker";
  }

  return "Workforce Member";
};

const toAvatarInitials = (name: string) => {
  const tokens = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const firstToken = tokens[0] ?? "";
  const secondToken = tokens[1] ?? "";

  if (tokens.length === 0) {
    return "WM";
  }

  if (tokens.length === 1) {
    return firstToken.slice(0, 2).toUpperCase();
  }

  return `${firstToken[0] ?? ""}${secondToken[0] ?? ""}`.toUpperCase();
};

const defaultCompanyName = "WorkForcePro";
const defaultTeamName = "General";
const defaultTeamCode = "GEN";

const getDefaultTeamCode = () => {
  const candidate = defaultTeamCode.toUpperCase();
  return candidate.length > 0 ? candidate.slice(0, 10) : "GEN";
};

const flattenZodCause = (cause: unknown) => {
  if (!(cause instanceof ZodError)) {
    return null;
  }

  return cause.flatten();
};

const ensureTenantDefaults = async () => {
  const existingCompany = await db.company.findFirst({
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
    },
  });

  if (existingCompany) {
    const fallbackTeam = await db.team.findFirst({
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
      },
      where: {
        companyId: existingCompany.id,
      },
    });

    if (fallbackTeam) {
      return {
        companyId: existingCompany.id,
        teamId: fallbackTeam.id,
      };
    }

    const createdTeam = await db.team.upsert({
      create: {
        code: getDefaultTeamCode(),
        color: "#24A148",
        companyId: existingCompany.id,
        name: defaultTeamName,
      },
      update: {},
      where: {
        companyId_code: {
          code: getDefaultTeamCode(),
          companyId: existingCompany.id,
        },
      },
    });

    return {
      companyId: existingCompany.id,
      teamId: createdTeam.id,
    };
  }

  const createdCompany = await db.company.upsert({
    create: {
      bankHolidayMultiplier: 2,
      currency: "EUR",
      name: defaultCompanyName,
      overtimeDailyThreshold: 8,
      overtimeMultiplier: 1.5,
      overtimeWeeklyThreshold: 40,
      payrollFrequency: "WEEKLY",
      standardDayHours: 8,
      standardWeekHours: 40,
      timezone: "Europe/Dublin",
    },
    select: {
      id: true,
    },
    update: {},
    where: {
      name: defaultCompanyName,
    },
  });

  const createdTeam = await db.team.upsert({
    create: {
      code: getDefaultTeamCode(),
      color: "#24A148",
      companyId: createdCompany.id,
      name: defaultTeamName,
    },
    select: {
      id: true,
    },
    update: {},
    where: {
      companyId_code: {
        code: getDefaultTeamCode(),
        companyId: createdCompany.id,
      },
    },
  });

  return {
    companyId: createdCompany.id,
    teamId: createdTeam.id,
  };
};

const syncViewerFromClerk = async (identity: ClerkIdentity) => {
  if (!identity.isAuthenticated || !identity.email) {
    return null;
  }

  const include = {
    company: true,
    team: true,
  } as const;

  const existingViewer = await db.user.findUnique({
    include,
    where: {
      email: identity.email,
    },
  });
  const displayName = getDisplayName(identity);
  const avatarInitials = toAvatarInitials(displayName);

  if (existingViewer) {
    const shouldUpdate =
      existingViewer.name !== displayName ||
      existingViewer.avatarInitials !== avatarInitials ||
      existingViewer.role !== identity.role ||
      !existingViewer.active;

    if (!shouldUpdate) {
      return existingViewer;
    }

    return db.user.update({
      data: {
        active: true,
        avatarInitials,
        name: displayName,
        role: identity.role,
      },
      include,
      where: {
        id: existingViewer.id,
      },
    });
  }

  const tenant = await ensureTenantDefaults();

  return db.user.create({
    data: {
      active: true,
      avatarInitials,
      companyId: tenant.companyId,
      email: identity.email,
      employmentType: "FULL_TIME",
      faceEnrolled: false,
      hireDate: new Date(),
      hourlyRate: 0,
      leaveBalanceDays: 0,
      name: displayName,
      role: identity.role,
      standardHoursPerWeek: 40,
      teamId: tenant.teamId,
    },
    include,
  });
};

const authenticateClerkRequest = async (request: Request) => {
  if (!clerkClient) {
    return createAnonymousIdentity();
  }

  try {
    const requestState = await withClerkTimeout(
      clerkClient.authenticateRequest(request, {
        acceptsToken: "session_token",
      }),
      "Clerk authenticateRequest",
    );
    const auth = requestState.toAuth();

    if (!auth?.isAuthenticated || !auth.userId) {
      return createAnonymousIdentity();
    }

    const user = await withClerkTimeout(
      clerkClient.users.getUser(auth.userId),
      "Clerk users.getUser",
    );

    return {
      email: getPrimaryEmailAddress(user),
      firstName: user.firstName,
      fullName: user.fullName,
      isAuthenticated: true,
      lastName: user.lastName,
      role: resolveClerkRole(user),
      userId: auth.userId,
    } satisfies ClerkIdentity;
  } catch (error) {
    console.warn("[Clerk] Failed to authenticate request", error);

    return createAnonymousIdentity();
  }
};

export const createTRPCContext = async (opts: {
  headers: Headers;
  request?: Request;
}) => {
  const viewerHeaderEmail =
    process.env.NODE_ENV === "production"
      ? null
      : resolveViewerEmailHeader(opts.headers);
  const request =
    opts.request ??
    new Request("http://localhost/api/trpc", {
      headers: opts.headers,
    });
  const clerk = await authenticateClerkRequest(request);
  const viewerFromClerk = await syncViewerFromClerk(clerk);
  const viewer =
    viewerFromClerk ??
    (viewerHeaderEmail
      ? await syncViewerFromClerk(toHeaderViewerIdentity(viewerHeaderEmail))
      : null);

  return {
    clerk,
    db,
    headers: opts.headers,
    viewer,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: flattenZodCause(error.cause),
    },
  }),
});

export const createTRPCRouter = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure
  .use(({ ctx, next }) => {
    if (!ctx.viewer) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return next({
      ctx: {
        ...ctx,
        viewer: ctx.viewer,
      },
    });
  });

export const managerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.viewer.role === "EMPLOYEE") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return next();
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.viewer.role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return next();
});
