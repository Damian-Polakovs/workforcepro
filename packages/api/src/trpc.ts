import { createClerkClient } from "@clerk/backend";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod/v4";

import { db, ensureDemoDataOnce } from "@acme/db";
import { DEFAULT_ADMIN_EMAIL, VIEWER_HEADER_NAME } from "@acme/validators";

interface ClerkIdentity {
  email: string | null;
  isAuthenticated: boolean;
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

const getPrimaryEmailAddress = async (userId: string) => {
  if (!clerkClient) {
    return null;
  }

  const user = await clerkClient.users.getUser(userId);
  const primaryEmail = user.emailAddresses.find(
    (emailAddress) => emailAddress.id === user.primaryEmailAddressId,
  );

  return (
    primaryEmail?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null
  );
};

const authenticateClerkRequest = async (request: Request) => {
  if (!clerkClient) {
    return {
      email: null,
      isAuthenticated: true,
      userId: null,
    } satisfies ClerkIdentity;
  }

  try {
    const requestState = await clerkClient.authenticateRequest(request, {
      acceptsToken: "session_token",
    });
    const auth = requestState.toAuth();

    if (!auth?.isAuthenticated || !auth.userId) {
      return {
        email: null,
        isAuthenticated: false,
        userId: null,
      } satisfies ClerkIdentity;
    }

    return {
      email: await getPrimaryEmailAddress(auth.userId),
      isAuthenticated: true,
      userId: auth.userId,
    } satisfies ClerkIdentity;
  } catch (error) {
    console.warn("[Clerk] Failed to authenticate request", error);

    return {
      email: null,
      isAuthenticated: false,
      userId: null,
    } satisfies ClerkIdentity;
  }
};

const findViewer = async (emails: (string | null | undefined)[]) => {
  const uniqueEmails = [
    ...new Set(emails.filter((email): email is string => Boolean(email))),
  ];

  for (const email of uniqueEmails) {
    const viewer = await db.user.findUnique({
      include: {
        company: true,
        team: true,
      },
      where: {
        email,
      },
    });

    if (viewer) {
      return viewer;
    }
  }

  return null;
};

export const createTRPCContext = async (opts: {
  headers: Headers;
  request?: Request;
}) => {
  await ensureDemoDataOnce(db);

  const request =
    opts.request ??
    new Request("http://localhost/api/trpc", {
      headers: opts.headers,
    });
  const clerk = await authenticateClerkRequest(request);

  const viewer = clerk.isAuthenticated
    ? await findViewer([
        clerk.email,
        opts.headers.get(VIEWER_HEADER_NAME),
        DEFAULT_ADMIN_EMAIL,
      ])
    : null;

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
      zodError:
        error.cause instanceof ZodError
          ? z.flattenError(error.cause as ZodError<Record<string, unknown>>)
          : null,
    },
  }),
});

export const createTRPCRouter = t.router;

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const startedAt = Date.now();
  const result = await next();
  const duration = Date.now() - startedAt;

  console.log(`[TRPC] ${path} completed in ${duration}ms`);
  return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
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
