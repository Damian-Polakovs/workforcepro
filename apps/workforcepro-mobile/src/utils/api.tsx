import { QueryClient } from "@tanstack/react-query";
import type {
  InvalidateQueryFilters,
  UseMutationOptions,
  UseQueryOptions,
} from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import type { PayrollFrequency, RouterOutputs } from "~/types/api";
import { VIEWER_HEADER_NAME } from "~/config/demo";

import { getBaseUrl } from "./base-url";
import { getActiveViewerEmailSync } from "./session-store";

export const queryClient = new QueryClient();

type ClerkTokenGetter = () => Promise<string | null>;

let clerkTokenGetter: ClerkTokenGetter | null = null;

export function setClerkTokenGetter(getter: ClerkTokenGetter | null) {
  clerkTokenGetter = getter;
}

type FaceScanPayload = {
  capturedAt: string;
  confidence: number;
  deviceLabel?: string;
  frameSignature: string;
  livenessPassed: boolean;
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
  auth: {
    currentViewer: {
      queryFilter: () => InvalidateQueryFilters<readonly unknown[]>;
    };
    demoProfiles: {
      queryOptions: () => UseQueryOptions<
        unknown,
        Error,
        unknown,
        readonly unknown[]
      >;
    };
  };
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
        async headers() {
          const headers = new Map<string, string>();
          const token = await clerkTokenGetter?.();

          if (token) {
            headers.set("authorization", `Bearer ${token}`);
          }

          headers.set("x-trpc-source", "expo-react");
          headers.set(VIEWER_HEADER_NAME, getActiveViewerEmailSync());
          return headers;
        },
        transformer: superjson,
        url: `${getBaseUrl()}/api/trpc`,
      }),
    ],
  }),
  queryClient,
}) as unknown as MobileTrpcProxy;

export type { RouterOutputs };
