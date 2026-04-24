import { z } from "zod/v4";

export const VIEWER_HEADER_NAME = "x-workforcepro-viewer-email";
export const DEMO_VIEWER_STORAGE_KEY = "workforcepro.active-viewer";

export const DEFAULT_ADMIN_EMAIL = "olivia.admin@workforcepro.dev";
export const DEFAULT_MANAGER_EMAIL = "marcus.manager@workforcepro.dev";

export const roleSchema = z.enum(["EMPLOYEE", "MANAGER", "ADMIN"]);
export const payrollFrequencySchema = z.enum([
  "WEEKLY",
  "FORTNIGHTLY",
  "MONTHLY",
]);
export const leaveTypeSchema = z.enum([
  "ANNUAL",
  "SICK",
  "MEDICAL",
  "PERSONAL",
  "UNPAID",
]);
export const leaveStatusSchema = z.enum(["PENDING", "APPROVED", "DECLINED"]);
export const correctionStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const defaultDemoProfiles = [
  {
    email: DEFAULT_ADMIN_EMAIL,
    headline: "Admin access with payroll and compliance controls.",
    name: "Olivia Byrne",
    role: "ADMIN",
  },
  {
    email: DEFAULT_MANAGER_EMAIL,
    headline: "Manager access with team approvals and analytics.",
    name: "Marcus Doyle",
    role: "MANAGER",
  },
  {
    email: "aisha.employee@workforcepro.dev",
    headline: "Employee view with active shift and correction history.",
    name: "Aisha Khan",
    role: "EMPLOYEE",
  },
  {
    email: "liam.employee@workforcepro.dev",
    headline: "Employee view with overnight and bank-holiday records.",
    name: "Liam Murphy",
    role: "EMPLOYEE",
  },
  {
    email: "sofia.employee@workforcepro.dev",
    headline: "Employee view with part-time leave balance and upcoming shifts.",
    name: "Sofia Walsh",
    role: "EMPLOYEE",
  },
] as const;

export const viewerEmailSchema = z
  .string()
  .email()
  .default(DEFAULT_ADMIN_EMAIL);

export const faceScanSchema = z.object({
  capturedAt: z.string().datetime(),
  confidence: z.number().min(0).max(1),
  deviceLabel: z.string().min(2).max(80).optional(),
  frameSignature: z.string().min(16).max(256),
  livenessPassed: z.boolean(),
});

export const enrollFaceInputSchema = z
  .object({
    consentAccepted: z.boolean(),
    faceScan: faceScanSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.consentAccepted) {
      ctx.addIssue({
        code: "custom",
        message: "Face scan consent must be accepted before enrollment.",
        path: ["consentAccepted"],
      });
    }
  });
export const clockActionInputSchema = z.object({
  faceScan: faceScanSchema,
  note: z.string().max(280).optional(),
});

export const breakActionInputSchema = z.object({
  note: z.string().max(160).optional(),
});

export const correctionRequestInputSchema = z.object({
  reason: z.string().min(12).max(280),
  requestedClockInAt: z.string().datetime().optional(),
  requestedClockOutAt: z.string().datetime().optional(),
  timesheetId: z.string().min(1),
});

export const leaveRequestInputSchema = z
  .object({
    endDate: z.string().date(),
    hours: z.number().positive().max(80).optional(),
    reason: z.string().min(12).max(280),
    startDate: z.string().date(),
    type: leaveTypeSchema,
  })
  .superRefine((value, ctx) => {
    if (value.endDate < value.startDate) {
      ctx.addIssue({
        code: "custom",
        message: "Leave end date must be on or after the start date.",
        path: ["endDate"],
      });
    }
  });

export const reviewLeaveInputSchema = z.object({
  comment: z.string().min(4).max(280),
  leaveRequestId: z.string().min(1),
  status: z.enum(["APPROVED", "DECLINED"]),
});

export const reviewCorrectionInputSchema = z.object({
  correctionId: z.string().min(1),
  resolutionNote: z.string().min(4).max(280),
  status: z.enum(["APPROVED", "REJECTED"]),
});

export const approveTimesheetInputSchema = z.object({
  signature: z.string().min(2).max(120),
  timesheetId: z.string().min(1),
});

export const payrollPreviewInputSchema = z.object({
  frequency: payrollFrequencySchema.default("WEEKLY"),
});

export const dashboardInputSchema = z.object({
  focus: z.enum(["MOBILE", "OPS"]).default("MOBILE"),
});

export type DemoProfile = (typeof defaultDemoProfiles)[number];
