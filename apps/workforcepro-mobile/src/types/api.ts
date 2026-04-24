export type DemoRole = "EMPLOYEE" | "MANAGER" | "ADMIN";
export type PayrollFrequency = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";

export type DashboardAlert = {
  detail: string;
  title: string;
  tone: "neutral" | "success" | "warning";
};

export type DashboardShift = {
  endTime: string | Date;
  id: string;
  label: string;
  notes: string | null;
  premiumMultiplier: number;
  range: string;
  startTime: string | Date;
  status: string;
  team: string;
};

export type DashboardTimesheet = {
  approvedBy: string | null;
  breakMinutes: number;
  clockInAt: string | Date | null;
  clockOutAt: string | Date | null;
  dateLabel: string;
  earlyDepartureMinutes: number;
  faceConfidence: number | null;
  faceVerified: boolean;
  grossPay: number;
  id: string;
  label: string;
  lateMinutes: number;
  overtimeMinutes: number;
  reference: string;
  status: string;
  team: string;
  workedHours: number;
};

export type LeaveCard = {
  comment: string | null;
  endDate: string | Date;
  hours: number;
  id: string;
  reason: string;
  reference: string;
  reviewedBy: string | null;
  startDate: string | Date;
  status: string;
  type: string;
  userName: string;
};

export type CorrectionCard = {
  id: string;
  reason: string;
  reference: string;
  requestedClockInAt: string | Date | null;
  requestedClockOutAt: string | Date | null;
  resolutionNote: string | null;
  reviewedBy: string | null;
  status: string;
  timesheetReference: string | null;
  userName: string;
};

export type AuditEntry = {
  action: string;
  actor: string;
  createdAt: string | Date;
  entityType: string;
  summary: string;
};

export type PayrollRow = {
  employee: string;
  grossPay: number;
  overtimeHours: number;
  regularHours: number;
  team: string;
  weeklyRiskHours: number;
};

export type PayrollPreview = {
  csv: string;
  frequency: PayrollFrequency;
  label: string;
  rows: PayrollRow[];
  totals: {
    employees: number;
    grossPay: number;
    overtimeHours: number;
    regularHours: number;
  };
};

export type DashboardData = {
  alerts: DashboardAlert[];
  auditTrail: AuditEntry[];
  company: {
    currency: string;
    name: string;
    overtimeDailyThreshold: number;
    overtimeWeeklyThreshold: number;
    payrollFrequency: PayrollFrequency;
    timezone: string;
  };
  currentViewerEmailFallback: string;
  pendingCorrections: CorrectionCard[];
  pendingLeave: LeaveCard[];
  payroll: PayrollPreview | null;
  queue: {
    absences: number;
    pendingCorrections: number;
    pendingLeave: number;
    pendingTimesheets: number;
  };
  recentTimesheets: DashboardTimesheet[];
  stats: {
    absences: number;
    grossPay: number;
    hoursThisCycle: number;
    lateIncidents: number;
    overtimeHours: number;
    punctualityScore: number;
  };
  teamBoard: Array<{
    avatarInitials: string;
    currentStatus: string;
    hoursThisCycle: number;
    latenessCount: number;
    name: string;
    openItems: number;
    team: string;
  }>;
  today: {
    activeTimesheet: DashboardTimesheet | null;
    focus: "MOBILE" | "OPS";
    shift: DashboardShift | null;
    status: "READY_TO_CLOCK_IN" | "CLOCKED_IN" | "ON_BREAK" | "OFF_ROSTER";
  };
  upcomingShifts: DashboardShift[];
  viewer: {
    avatarInitials: string;
    defaultProfile: string;
    email: string;
    faceEnrollmentCapturedAt: string | Date | null;
    faceEnrollmentConfidence: number | null;
    faceEnrolled: boolean;
    hourlyRate: number;
    leaveBalanceDays: number;
    name: string;
    role: DemoRole;
    teamName: string;
  };
};

export type RouterOutputs = {
  workforce: {
    dashboard: DashboardData;
    enrollFace: DashboardData;
    payrollPreview: PayrollPreview;
  };
};
