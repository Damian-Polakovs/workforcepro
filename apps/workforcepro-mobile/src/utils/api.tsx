import type {
  InvalidateQueryFilters,
  UseMutationOptions,
  UseQueryOptions,
} from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import type { PayrollFrequency, RouterOutputs } from "~/types/api";
import { VIEWER_HEADER_NAME } from "~/config/demo";
import { getBaseUrlCandidates } from "./base-url";
import { getActiveViewerEmailSync } from "./session-store";

export const queryClient = new QueryClient();
const trpcBaseUrlCandidates = getBaseUrlCandidates();
const trpcUrlCandidates = trpcBaseUrlCandidates.map(
  (baseUrl) => `${baseUrl}/api/trpc`,
);
const primaryTrpcUrl = trpcUrlCandidates[0];
let activeTrpcUrl = primaryTrpcUrl;
const getBaseRequestUrls = () => [
  activeTrpcUrl,
  ...trpcUrlCandidates.filter((url) => url !== activeTrpcUrl),
];
const clerkTokenTimeoutMs = 4_000;
const networkRequestTimeoutMs = __DEV__ ? 30_000 : 15_000;
const networkAttemptTimeoutMs = __DEV__ ? 12_000 : 4_000;
const devBackendHint =
  " Start the Next.js backend with pnpm dev or pnpm dev:backend, and confirm this device can reach the API network URL.";

if (__DEV__) {
  console.info("[trpc] API URL candidates:", trpcUrlCandidates);
}

type ClerkTokenGetter = () => Promise<string | null>;

let clerkTokenGetter: ClerkTokenGetter | null = null;

export function setClerkTokenGetter(getter: ClerkTokenGetter | null) {
  clerkTokenGetter = getter;
}

const resolveClerkToken = async () => {
  if (!clerkTokenGetter) {
    return null;
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      clerkTokenGetter(),
      new Promise<null>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(null), clerkTokenTimeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";
const isLikelyNetworkError = (error: unknown) => {
  if (isAbortError(error)) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const text = error.message.toLowerCase();
  return (
    text.includes("network request failed") || text.includes("failed to fetch")
  );
};
const readInputUrl = (input: RequestInfo | URL) => {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.url;
  }

  return String(input);
};
const replaceUrlBase = (value: string, nextBaseUrl: string) => {
  for (const knownBaseUrl of trpcUrlCandidates) {
    if (value.startsWith(knownBaseUrl)) {
      return `${nextBaseUrl}${value.slice(knownBaseUrl.length)}`;
    }
  }

  if (value.startsWith(primaryTrpcUrl)) {
    return `${nextBaseUrl}${value.slice(primaryTrpcUrl.length)}`;
  }

  try {
    const source = new URL(value);
    const target = new URL(nextBaseUrl);

    source.protocol = target.protocol;
    source.host = target.host;
    return source.toString();
  } catch {
    return nextBaseUrl;
  }
};

type FaceScanPayload = {
  capturedAt: string;
  deviceLabel?: string;
  frameSignature: string;
  imageBase64: string;
};

type MutationOptionsBuilder<TInput> = {
  mutationOptions: (
    options?: UseMutationOptions<unknown, Error, TInput>,
  ) => UseMutationOptions<unknown, Error, TInput>;
};

type QueryOptionsBuilder<TInput, TOutput> = {
  queryFilter: () => InvalidateQueryFilters<readonly unknown[]>;
  queryOptions: (
    input: TInput,
  ) => UseQueryOptions<TOutput, Error, TOutput, readonly unknown[]>;
};

type DashboardOutput = RouterOutputs["workforce"]["dashboard"];
type PayrollPreviewOutput = RouterOutputs["workforce"]["payrollPreview"];

type MobileTrpcProxy = {
  workforce: {
    approveTimesheet: MutationOptionsBuilder<{
      signature: string;
      timesheetId: string;
    }>;
    clockIn: MutationOptionsBuilder<{
      faceScan: FaceScanPayload;
      note?: string;
    }>;
    clockOut: MutationOptionsBuilder<{
      faceScan: FaceScanPayload;
      note?: string;
    }>;
    dashboard: QueryOptionsBuilder<
      { focus: "MOBILE" | "OPS" },
      DashboardOutput
    >;
    endBreak: MutationOptionsBuilder<Record<string, never>>;
    enrollFace: MutationOptionsBuilder<{
      consentAccepted: boolean;
      faceScan: FaceScanPayload;
    }>;
    payrollPreview: QueryOptionsBuilder<
      { frequency: PayrollFrequency },
      PayrollPreviewOutput
    >;
    requestCorrection: MutationOptionsBuilder<{
      reason: string;
      requestedClockInAt?: string;
      requestedClockOutAt?: string;
      timesheetId: string;
    }>;
    requestLeave: MutationOptionsBuilder<{
      endDate: string;
      hours?: number;
      reason: string;
      startDate: string;
      type: "ANNUAL" | "SICK" | "MEDICAL" | "PERSONAL" | "UNPAID";
    }>;
    reviewCorrection: MutationOptionsBuilder<{
      correctionId: string;
      resolutionNote: string;
      status: "APPROVED" | "REJECTED";
    }>;
    reviewLeave: MutationOptionsBuilder<{
      comment: string;
      leaveRequestId: string;
      status: "APPROVED" | "DECLINED";
    }>;
    startBreak: MutationOptionsBuilder<{
      note?: string;
    }>;
  };
};

export const trpc = createTRPCOptionsProxy<any>({
  client: createTRPCClient<any>({
    links: [
      loggerLink({
        colorMode: "ansi",
        enabled: (opts) =>
          process.env.NODE_ENV === "development" ||
          (opts.direction === "down" && opts.result instanceof Error),
      }),
      httpBatchLink({
        async fetch(input, init) {
          const sourceUrl = readInputUrl(input);
          const attemptedUrls: string[] = [];
          let lastNetworkError: unknown = null;
          const requestStartedAt = Date.now();

          for (const candidateUrl of getBaseRequestUrls()) {
            const elapsedMs = Date.now() - requestStartedAt;
            const remainingMs = networkRequestTimeoutMs - elapsedMs;

            if (remainingMs <= 0) {
              const timeoutError = new Error("Request timed out.");
              timeoutError.name = "AbortError";
              lastNetworkError = timeoutError;
              break;
            }

            attemptedUrls.push(candidateUrl);

            const abortController = new AbortController();
            const timeout = setTimeout(
              () => abortController.abort(),
              Math.min(networkAttemptTimeoutMs, remainingMs),
            );

            try {
              const requestUrl = replaceUrlBase(sourceUrl, candidateUrl);
              const response = await fetch(requestUrl, {
                ...init,
                signal: abortController.signal,
              });
              activeTrpcUrl = candidateUrl;
              return response;
            } catch (error) {
              if (!isLikelyNetworkError(error)) {
                throw error;
              }

              lastNetworkError = error;
            } finally {
              clearTimeout(timeout);
            }
          }

          if (isAbortError(lastNetworkError)) {
            throw new Error(
              `Request timed out after ${networkRequestTimeoutMs / 1000}s while contacting ${attemptedUrls.join(", ")}.${__DEV__ ? devBackendHint : ""}`,
            );
          }

          throw new Error(
            `Network request failed while contacting ${attemptedUrls.join(", ")}.${__DEV__ ? devBackendHint : ""}`,
          );
        },
        async headers() {
          const headers: Record<string, string> = {};
          const token = await resolveClerkToken();

          if (token) {
            headers.authorization = `Bearer ${token}`;
          }

          const viewerEmail = getActiveViewerEmailSync();
          if (viewerEmail) {
            headers[VIEWER_HEADER_NAME] = viewerEmail;
          }

          headers["x-trpc-source"] = "expo-react";
          return headers;
        },
        transformer: superjson,
        url: primaryTrpcUrl,
      }),
    ],
  }),
  queryClient,
}) as unknown as MobileTrpcProxy;

export type { RouterOutputs };
