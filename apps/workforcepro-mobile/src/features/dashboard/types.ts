import type { DemoProfile } from "~/config/demo";
import type { RouterOutputs } from "~/utils/api";

export type DashboardData = RouterOutputs["workforce"]["dashboard"];
export type DashboardAlert = NonNullable<DashboardData["alerts"][number]>;
export type DashboardTimesheet = DashboardData["recentTimesheets"][number];
export type PayrollPreviewData = RouterOutputs["workforce"]["payrollPreview"];
export type { DemoProfile };

export type LeaveType = "ANNUAL" | "SICK" | "MEDICAL" | "PERSONAL" | "UNPAID";

export const leaveTypes: readonly LeaveType[] = [
  "ANNUAL",
  "SICK",
  "MEDICAL",
  "PERSONAL",
  "UNPAID",
];
