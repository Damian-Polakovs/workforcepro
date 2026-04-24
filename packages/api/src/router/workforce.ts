import { createHash } from "node:crypto";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import type { Prisma, PrismaClient } from "@acme/db";
import {
  buildPayrollCsv,
  calculateBreakMinutes,
  calculateTimesheetMetrics,
  CorrectionStatus,
  endOfDay,
  formatDisplayDate,
  formatDisplayTime,
  getPayrollPeriodRange,
  isTimesheetOpen,
  LeaveStatus,
  roundCurrency,
  shiftLabel,
  startOfDay,
  TimesheetStatus,
} from "@acme/db";
import {
  approveTimesheetInputSchema,
  breakActionInputSchema,
  clockActionInputSchema,
  correctionRequestInputSchema,
  dashboardInputSchema,
  DEFAULT_ADMIN_EMAIL,
  defaultDemoProfiles,
  enrollFaceInputSchema,
  leaveRequestInputSchema,
  payrollPreviewInputSchema,
  reviewCorrectionInputSchema,
  reviewLeaveInputSchema,
} from "@acme/validators";

import type { createTRPCContext } from "../trpc";
import { managerProcedure, protectedProcedure } from "../trpc";

const shiftInclude = {
  assignee: {
    select: {
      avatarInitials: true,
      name: true,
      role: true,
    },
  },
  team: {
    select: {
      color: true,
      name: true,
    },
  },
} as const;

const timesheetInclude = {
  approvedBy: {
    select: {
      name: true,
    },
  },
  breaks: true,
  shift: {
    include: shiftInclude,
  },
  user: {
    include: {
      team: {
        select: {
          name: true,
        },
      },
    },
  },
} as const;

const leaveInclude = {
  approver: {
    select: {
      name: true,
    },
  },
  user: {
    include: {
      team: {
        select: {
          name: true,
        },
      },
    },
  },
} as const;

const correctionInclude = {
  reviewer: {
    select: {
      name: true,
    },
  },
  timesheet: {
    select: {
      id: true,
      reference: true,
      workDate: true,
    },
  },
  user: {
    include: {
      team: {
        select: {
          name: true,
        },
      },
    },
  },
} as const;

const auditInclude = {
  actor: {
    select: {
      name: true,
      role: true,
    },
  },
} as const;

type Viewer = NonNullable<
  Awaited<ReturnType<typeof createTRPCContext>>["viewer"]
>;
type ShiftCardSource = Prisma.ShiftGetPayload<{ include: typeof shiftInclude }>;
type TimesheetCardSource = Prisma.TimesheetGetPayload<{
  include: typeof timesheetInclude;
}>;
type LeaveCardSource = Prisma.LeaveRequestGetPayload<{
  include: typeof leaveInclude;
}>;
type CorrectionCardSource = Prisma.TimeCorrectionGetPayload<{
  include: typeof correctionInclude;
}>;
type AuditCardSource = Prisma.AuditLogGetPayload<{
  include: typeof auditInclude;
}>;

function scopedUserWhere(viewer: Viewer): Prisma.UserWhereInput {
  if (viewer.role === "ADMIN") {
    return {
      companyId: viewer.companyId,
    };
  }

  if (viewer.role === "MANAGER") {
    return {
      companyId: viewer.companyId,
      role: "EMPLOYEE",
      teamId: viewer.teamId ?? "__missing_team__",
    };
  }

  return {
    id: viewer.id,
  };
}

function scopedShiftWhere(viewer: Viewer): Prisma.ShiftWhereInput {
  if (viewer.role === "ADMIN") {
    return {
      companyId: viewer.companyId,
    };
  }

  if (viewer.role === "MANAGER") {
    return {
      companyId: viewer.companyId,
      teamId: viewer.teamId ?? "__missing_team__",
    };
  }

  return {
    assignedToId: viewer.id,
    companyId: viewer.companyId,
  };
}

function scopedTimesheetWhere(viewer: Viewer): Prisma.TimesheetWhereInput {
  if (viewer.role === "ADMIN") {
    return {
      companyId: viewer.companyId,
    };
  }

  if (viewer.role === "MANAGER") {
    return {
      companyId: viewer.companyId,
      user: {
        teamId: viewer.teamId ?? "__missing_team__",
      },
    };
  }

  return {
    companyId: viewer.companyId,
    userId: viewer.id,
  };
}

function scopedLeaveWhere(viewer: Viewer): Prisma.LeaveRequestWhereInput {
  if (viewer.role === "ADMIN") {
    return {
      companyId: viewer.companyId,
    };
  }

  if (viewer.role === "MANAGER") {
    return {
      companyId: viewer.companyId,
      user: {
        teamId: viewer.teamId ?? "__missing_team__",
      },
    };
  }

  return {
    companyId: viewer.companyId,
    userId: viewer.id,
  };
}

function scopedCorrectionWhere(
  viewer: Viewer,
): Prisma.TimeCorrectionWhereInput {
  if (viewer.role === "ADMIN") {
    return {
      companyId: viewer.companyId,
    };
  }

  if (viewer.role === "MANAGER") {
    return {
      companyId: viewer.companyId,
      user: {
        teamId: viewer.teamId ?? "__missing_team__",
      },
    };
  }

  return {
    companyId: viewer.companyId,
    userId: viewer.id,
  };
}

function assertFaceMatch(faceScan: {
  confidence: number;
  livenessPassed: boolean;
}) {
  if (!faceScan.livenessPassed || faceScan.confidence < 0.84) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Face verification did not reach the minimum confidence for a secure clock event.",
    });
  }
}

function assertFaceEnrollment(viewer: Viewer) {
  if (!viewer.faceEnrolled || !viewer.faceTemplateHash) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Create your first face scan before using secure clock in or clock out.",
    });
  }
}

function buildFaceTemplateHash(input: {
  faceScan: { capturedAt: string; frameSignature: string };
  userId: string;
}) {
  return createHash("sha256")
    .update(
      `${input.userId}:${input.faceScan.frameSignature}:${input.faceScan.capturedAt}`,
    )
    .digest("hex");
}
function toShiftCard(shift: ShiftCardSource) {
  return {
    id: shift.id,
    label: shiftLabel(shift),
    premiumMultiplier: shift.premiumMultiplier,
    range: `${formatDisplayDate(shift.startTime)} Â· ${formatDisplayTime(shift.startTime)}-${formatDisplayTime(shift.endTime)}`,
    startTime: shift.startTime,
    endTime: shift.endTime,
    notes: shift.notes,
    status: shift.status,
    team: shift.team.name,
  };
}

function toTimesheetCard(timesheet: TimesheetCardSource) {
  const workedMinutes =
    timesheet.clockInAt && timesheet.clockOutAt
      ? Math.max(
          Math.round(
            (timesheet.clockOutAt.getTime() - timesheet.clockInAt.getTime()) /
              60_000,
          ) - calculateBreakMinutes(timesheet.breaks),
          0,
        )
      : 0;

  return {
    approvedBy: timesheet.approvedBy?.name ?? null,
    breakMinutes: timesheet.breakMinutes,
    clockInAt: timesheet.clockInAt,
    clockOutAt: timesheet.clockOutAt,
    dateLabel: formatDisplayDate(timesheet.workDate),
    earlyDepartureMinutes: timesheet.earlyDepartureMinutes,
    faceConfidence: timesheet.faceConfidence,
    faceVerified: timesheet.faceVerified,
    grossPay: timesheet.grossPay,
    id: timesheet.id,
    label: timesheet.shift
      ? shiftLabel(timesheet.shift)
      : `Unscheduled shift Â· ${formatDisplayDate(timesheet.workDate)}`,
    lateMinutes: timesheet.lateMinutes,
    overtimeMinutes: timesheet.overtimeMinutes,
    reference: timesheet.reference,
    status: timesheet.status,
    team: timesheet.user.team?.name ?? "Unassigned",
    workedHours: roundCurrency(workedMinutes / 60),
  };
}

function toLeaveCard(leave: LeaveCardSource) {
  return {
    comment: leave.comment,
    endDate: leave.endDate,
    hours: leave.hours,
    id: leave.id,
    reason: leave.reason,
    reference: leave.reference,
    reviewedBy: leave.approver?.name ?? null,
    startDate: leave.startDate,
    status: leave.status,
    type: leave.type,
    userName: leave.user.name,
  };
}

function toCorrectionCard(correction: CorrectionCardSource) {
  return {
    id: correction.id,
    reason: correction.reason,
    reference: correction.reference,
    requestedClockInAt: correction.requestedClockInAt,
    requestedClockOutAt: correction.requestedClockOutAt,
    resolutionNote: correction.resolutionNote,
    reviewedBy: correction.reviewer?.name ?? null,
    status: correction.status,
    timesheetReference: correction.timesheet?.reference ?? null,
    userName: correction.user.name,
  };
}

function toAuditCard(entry: AuditCardSource) {
  return {
    action: entry.action,
    actor: entry.actor?.name ?? "System",
    createdAt: entry.createdAt,
    entityType: entry.entityType,
    summary: entry.summary,
  };
}

function summarizePunctuality(timesheets: TimesheetCardSource[]) {
  const lateIncidents = timesheets.filter(
    (entry) => entry.lateMinutes > 0,
  ).length;
  const earlyDepartures = timesheets.filter(
    (entry) => entry.earlyDepartureMinutes > 0,
  ).length;
  const punctualityScore =
    timesheets.length === 0
      ? 100
      : Math.max(
          60,
          Math.round(
            ((timesheets.length - lateIncidents - earlyDepartures) /
              timesheets.length) *
              100,
          ),
        );

  return {
    earlyDepartures,
    lateIncidents,
    punctualityScore,
  };
}

async function createAudit(
  db: PrismaClient,
  input: {
    actorId: string;
    companyId: string;
    action: string;
    entityId: string;
    entityType: string;
    summary: string;
  },
) {
  await db.auditLog.create({
    data: input,
  });
}

async function buildPayrollPreview(args: {
  db: PrismaClient;
  viewer: Viewer;
  frequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
}) {
  const range = getPayrollPeriodRange(new Date(), args.frequency);
  const company = args.viewer.company;
  const users = await args.db.user.findMany({
    include: {
      team: true,
      timesheets: {
        orderBy: {
          workDate: "asc",
        },
        where: {
          workDate: {
            gte: range.start,
            lte: range.end,
          },
        },
      },
    },
    where: scopedUserWhere(args.viewer),
  });

  const periodMultiplier =
    args.frequency === "WEEKLY" ? 1 : args.frequency === "FORTNIGHTLY" ? 2 : 4;
  const overtimeThresholdMinutes =
    company.overtimeWeeklyThreshold * 60 * periodMultiplier;

  const rows = users
    .filter((user) => user.role !== "ADMIN")
    .map((user) => {
      const totalRegularMinutes = user.timesheets.reduce(
        (sum, entry) => sum + entry.regularMinutes,
        0,
      );
      const dailyOvertimeMinutes = user.timesheets.reduce(
        (sum, entry) => sum + entry.overtimeMinutes,
        0,
      );
      const totalWorkedMinutes = totalRegularMinutes + dailyOvertimeMinutes;
      const weeklyOvertimeMinutes = Math.max(
        totalWorkedMinutes - overtimeThresholdMinutes,
        0,
      );
      const payableOvertimeMinutes = Math.max(
        dailyOvertimeMinutes,
        weeklyOvertimeMinutes,
      );
      const extraWeeklyMinutes = Math.max(
        payableOvertimeMinutes - dailyOvertimeMinutes,
        0,
      );
      const baseGross = user.timesheets.reduce(
        (sum, entry) => sum + entry.grossPay,
        0,
      );
      const weeklyAdjustment =
        (extraWeeklyMinutes / 60) *
        user.hourlyRate *
        (company.overtimeMultiplier - 1);
      const grossPay = roundCurrency(baseGross + weeklyAdjustment);

      return {
        employee: user.name,
        grossPay,
        overtimeHours: roundCurrency(payableOvertimeMinutes / 60),
        regularHours: roundCurrency(
          Math.max(totalWorkedMinutes - payableOvertimeMinutes, 0) / 60,
        ),
        team: user.team?.name ?? "Unassigned",
        weeklyRiskHours: roundCurrency(weeklyOvertimeMinutes / 60),
      };
    });

  return {
    csv: buildPayrollCsv(rows),
    frequency: args.frequency,
    label: `${formatDisplayDate(range.start)} - ${formatDisplayDate(range.end)}`,
    rows,
    totals: {
      employees: rows.length,
      grossPay: roundCurrency(rows.reduce((sum, row) => sum + row.grossPay, 0)),
      overtimeHours: roundCurrency(
        rows.reduce((sum, row) => sum + row.overtimeHours, 0),
      ),
      regularHours: roundCurrency(
        rows.reduce((sum, row) => sum + row.regularHours, 0),
      ),
    },
  };
}

async function loadDashboard(args: {
  db: PrismaClient;
  viewer: Viewer;
  focus: "MOBILE" | "OPS";
}) {
  const now = new Date();
  const dashboardRange = getPayrollPeriodRange(
    now,
    args.viewer.company.payrollFrequency,
  );

  const [
    upcomingShifts,
    todayShifts,
    activeTimesheet,
    recentTimesheets,
    pendingLeave,
    pendingCorrections,
    recentAudit,
    teamMembers,
    absences,
    payroll,
  ] = await Promise.all([
    args.db.shift.findMany({
      include: shiftInclude,
      orderBy: {
        startTime: "asc",
      },
      take: 4,
      where: {
        ...scopedShiftWhere(args.viewer),
        endTime: {
          gte: now,
        },
        status: "PUBLISHED",
      },
    }),
    args.db.shift.findMany({
      include: shiftInclude,
      orderBy: {
        startTime: "asc",
      },
      where: {
        ...scopedShiftWhere(args.viewer),
        startTime: {
          gte: startOfDay(now),
          lte: endOfDay(now),
        },
      },
    }),
    args.db.timesheet.findFirst({
      include: timesheetInclude,
      orderBy: {
        createdAt: "desc",
      },
      where: {
        ...scopedTimesheetWhere(args.viewer),
        status: {
          in: [TimesheetStatus.CLOCKED_IN, TimesheetStatus.ON_BREAK],
        },
      },
    }),
    args.db.timesheet.findMany({
      include: timesheetInclude,
      orderBy: {
        workDate: "desc",
      },
      take: 6,
      where: {
        ...scopedTimesheetWhere(args.viewer),
        workDate: {
          gte: dashboardRange.start,
          lte: dashboardRange.end,
        },
      },
    }),
    args.db.leaveRequest.findMany({
      include: leaveInclude,
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      where: {
        ...scopedLeaveWhere(args.viewer),
        status: LeaveStatus.PENDING,
      },
    }),
    args.db.timeCorrection.findMany({
      include: correctionInclude,
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      where: {
        ...scopedCorrectionWhere(args.viewer),
        status: CorrectionStatus.PENDING,
      },
    }),
    args.db.auditLog.findMany({
      include: auditInclude,
      orderBy: {
        createdAt: "desc",
      },
      take: args.focus === "OPS" ? 8 : 4,
      where: {
        companyId: args.viewer.companyId,
      },
    }),
    args.db.user.findMany({
      include: {
        team: true,
        timesheets: {
          orderBy: {
            workDate: "desc",
          },
          take: 3,
          where: {
            workDate: {
              gte: dashboardRange.start,
              lte: dashboardRange.end,
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
      take: args.focus === "OPS" ? 8 : 4,
      where: scopedUserWhere(args.viewer),
    }),
    args.db.shift.findMany({
      include: {
        assignee: {
          select: {
            name: true,
          },
        },
        timesheet: {
          select: {
            id: true,
          },
        },
      },
      where: {
        ...scopedShiftWhere(args.viewer),
        endTime: {
          lt: now,
        },
        startTime: {
          gte: dashboardRange.start,
        },
        timesheet: {
          is: null,
        },
      },
    }),
    args.viewer.role === "EMPLOYEE"
      ? Promise.resolve(null)
      : buildPayrollPreview({
          db: args.db,
          frequency: args.viewer.company.payrollFrequency,
          viewer: args.viewer,
        }),
  ]);

  const currentShift = todayShifts[0] ?? upcomingShifts[0] ?? null;
  const stats = recentTimesheets.reduce(
    (summary, entry) => ({
      grossPay: summary.grossPay + entry.grossPay,
      hoursThisCycle:
        summary.hoursThisCycle +
        (entry.regularMinutes + entry.overtimeMinutes) / 60,
      overtimeHours: summary.overtimeHours + entry.overtimeMinutes / 60,
    }),
    {
      grossPay: 0,
      hoursThisCycle: 0,
      overtimeHours: 0,
    },
  );
  const punctuality = summarizePunctuality(recentTimesheets);
  const alerts = [
    currentShift && !activeTimesheet
      ? {
          detail: `Next shift starts ${formatDisplayDate(currentShift.startTime)} at ${formatDisplayTime(currentShift.startTime)}.`,
          tone: "neutral",
          title: "Roster ready",
        }
      : null,
    activeTimesheet
      ? {
          detail: `Clocked in at ${activeTimesheet.clockInAt ? formatDisplayTime(activeTimesheet.clockInAt) : "now"} with facial verification captured.`,
          tone: "success",
          title: "Active shift in progress",
        }
      : null,
    pendingLeave.length > 0 && args.viewer.role !== "EMPLOYEE"
      ? {
          detail: `${pendingLeave.length} leave request${pendingLeave.length > 1 ? "s" : ""} waiting for review.`,
          tone: "warning",
          title: "Manager action required",
        }
      : null,
    absences.length > 0
      ? {
          detail: `${absences.length} published shift${absences.length > 1 ? "s were" : " was"} missed inside the current pay cycle.`,
          tone: "warning",
          title: "Attendance gap detected",
        }
      : null,
  ].filter(Boolean);

  return {
    alerts,
    auditTrail: recentAudit.map(toAuditCard),
    company: {
      currency: args.viewer.company.currency,
      name: args.viewer.company.name,
      overtimeDailyThreshold: args.viewer.company.overtimeDailyThreshold,
      overtimeWeeklyThreshold: args.viewer.company.overtimeWeeklyThreshold,
      payrollFrequency: args.viewer.company.payrollFrequency,
      timezone: args.viewer.company.timezone,
    },
    currentViewerEmailFallback: DEFAULT_ADMIN_EMAIL,
    pendingCorrections: pendingCorrections.map(toCorrectionCard),
    pendingLeave: pendingLeave.map(toLeaveCard),
    payroll,
    queue: {
      absences: absences.length,
      pendingCorrections: pendingCorrections.length,
      pendingLeave: pendingLeave.length,
      pendingTimesheets: recentTimesheets.filter(
        (entry) => entry.status === TimesheetStatus.CLOCKED_OUT,
      ).length,
    },
    recentTimesheets: recentTimesheets.map(toTimesheetCard),
    stats: {
      ...punctuality,
      absences: absences.length,
      grossPay: roundCurrency(stats.grossPay),
      hoursThisCycle: roundCurrency(stats.hoursThisCycle),
      overtimeHours: roundCurrency(stats.overtimeHours),
    },
    teamBoard: teamMembers.map((member) => {
      const memberHours = member.timesheets.reduce(
        (sum, entry) => sum + entry.regularMinutes + entry.overtimeMinutes,
        0,
      );
      const openEntry = member.timesheets.find(isTimesheetOpen);
      const latenessCount = member.timesheets.filter(
        (entry) => entry.lateMinutes > 0,
      ).length;

      return {
        avatarInitials: member.avatarInitials,
        currentStatus: openEntry
          ? "Clocked in"
          : member.role === "EMPLOYEE"
            ? "Awaiting next shift"
            : "Operations view",
        hoursThisCycle: roundCurrency(memberHours / 60),
        latenessCount,
        name: member.name,
        openItems: pendingCorrections.filter(
          (entry) => entry.userId === member.id,
        ).length,
        team: member.team?.name ?? "Unassigned",
      };
    }),
    today: {
      activeTimesheet: activeTimesheet
        ? toTimesheetCard(activeTimesheet)
        : null,
      focus: args.focus,
      shift: currentShift ? toShiftCard(currentShift) : null,
      status: activeTimesheet
        ? activeTimesheet.status === TimesheetStatus.ON_BREAK
          ? "ON_BREAK"
          : "CLOCKED_IN"
        : currentShift
          ? "READY_TO_CLOCK_IN"
          : "OFF_ROSTER",
    },
    upcomingShifts: upcomingShifts.map(toShiftCard),
    viewer: {
      avatarInitials: args.viewer.avatarInitials,
      defaultProfile:
        defaultDemoProfiles.find((entry) => entry.email === args.viewer.email)
          ?.headline ?? "WorkForcePro dashboard access",
      email: args.viewer.email,
      faceEnrollmentCapturedAt: args.viewer.faceEnrollmentCapturedAt,
      faceEnrollmentConfidence: args.viewer.faceEnrollmentConfidence,
      faceEnrolled:
        args.viewer.faceEnrolled && Boolean(args.viewer.faceTemplateHash),
      hourlyRate: args.viewer.hourlyRate,
      leaveBalanceDays: args.viewer.leaveBalanceDays,
      name: args.viewer.name,
      role: args.viewer.role,
      teamName: args.viewer.team?.name ?? "Unassigned",
    },
  };
}

async function findViewerOpenTimesheet(args: {
  db: PrismaClient;
  viewer: Viewer;
}) {
  return args.db.timesheet.findFirst({
    include: timesheetInclude,
    orderBy: {
      createdAt: "desc",
    },
    where: {
      status: {
        in: [TimesheetStatus.CLOCKED_IN, TimesheetStatus.ON_BREAK],
      },
      userId: args.viewer.id,
    },
  });
}

async function recalculateTimesheet(args: {
  db: PrismaClient;
  timesheetId: string;
}) {
  const timesheet = await args.db.timesheet.findUniqueOrThrow({
    include: {
      breaks: true,
      shift: true,
      user: true,
    },
    where: {
      id: args.timesheetId,
    },
  });

  if (!timesheet.clockInAt || !timesheet.clockOutAt) {
    return timesheet;
  }

  const company = await args.db.company.findUniqueOrThrow({
    where: {
      id: timesheet.companyId,
    },
  });

  const metrics = calculateTimesheetMetrics({
    bankHoliday: timesheet.shift?.bankHoliday ?? false,
    bankHolidayMultiplier: company.bankHolidayMultiplier,
    breaks: timesheet.breaks,
    clockInAt: timesheet.clockInAt,
    clockOutAt: timesheet.clockOutAt,
    hourlyRate: timesheet.user.hourlyRate,
    overtimeDailyThresholdHours: company.overtimeDailyThreshold,
    overtimeMultiplier: company.overtimeMultiplier,
    premiumMultiplier: timesheet.shift?.premiumMultiplier,
    scheduledEnd: timesheet.shift?.endTime,
    scheduledStart: timesheet.shift?.startTime,
  });

  return args.db.timesheet.update({
    data: {
      breakMinutes: metrics.breakMinutes,
      earlyDepartureMinutes: metrics.earlyDepartureMinutes,
      grossPay: metrics.grossPay,
      lateMinutes: metrics.lateMinutes,
      overtimeMinutes: metrics.overtimeMinutes,
      regularMinutes: metrics.regularMinutes,
    },
    include: timesheetInclude,
    where: {
      id: timesheet.id,
    },
  });
}

export const workforceRouter = {
  approveTimesheet: managerProcedure
    .input(approveTimesheetInputSchema)
    .mutation(async ({ ctx, input }) => {
      const timesheet = await ctx.db.timesheet.findUniqueOrThrow({
        include: {
          user: true,
        },
        where: {
          id: input.timesheetId,
        },
      });

      if (
        ctx.viewer.role === "MANAGER" &&
        timesheet.user.teamId !== ctx.viewer.teamId
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db.timesheet.update({
        data: {
          approvalSignature: input.signature,
          approvedAt: new Date(),
          approvedById: ctx.viewer.id,
          status: TimesheetStatus.APPROVED,
        },
        where: {
          id: input.timesheetId,
        },
      });

      await createAudit(ctx.db, {
        action: "timesheet.approved",
        actorId: ctx.viewer.id,
        companyId: ctx.viewer.companyId,
        entityId: input.timesheetId,
        entityType: "Timesheet",
        summary: `${ctx.viewer.name} approved ${timesheet.user.name}'s timesheet with a digital signature.`,
      });

      return loadDashboard({
        db: ctx.db,
        focus: "OPS",
        viewer: ctx.viewer,
      });
    }),

  clockIn: protectedProcedure
    .input(clockActionInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertFaceEnrollment(ctx.viewer);
      assertFaceMatch(input.faceScan);

      const openTimesheet = await findViewerOpenTimesheet({
        db: ctx.db,
        viewer: ctx.viewer,
      });

      if (openTimesheet) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have an active shift in progress.",
        });
      }

      const shift = await ctx.db.shift.findFirst({
        orderBy: {
          startTime: "asc",
        },
        where: {
          assignedToId: ctx.viewer.id,
          companyId: ctx.viewer.companyId,
          endTime: {
            gte: new Date(Date.now() - 12 * 60 * 60 * 1000),
          },
          startTime: {
            lte: new Date(Date.now() + 8 * 60 * 60 * 1000),
          },
        },
      });

      if (!shift) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "No scheduled shift is currently inside the allowed clock-in window.",
        });
      }

      const timesheet = await ctx.db.timesheet.create({
        data: {
          clockInAt: new Date(input.faceScan.capturedAt),
          companyId: ctx.viewer.companyId,
          faceConfidence: input.faceScan.confidence,
          faceVerified: true,
          notes: input.note,
          reference: `TS-${ctx.viewer.id}-${Date.now()}`,
          shiftId: shift.id,
          status: TimesheetStatus.CLOCKED_IN,
          userId: ctx.viewer.id,
          workDate: startOfDay(new Date()),
        },
      });

      await createAudit(ctx.db, {
        action: "timesheet.clock_in",
        actorId: ctx.viewer.id,
        companyId: ctx.viewer.companyId,
        entityId: timesheet.id,
        entityType: "Timesheet",
        summary: `${ctx.viewer.name} clocked in with a verified face match.`,
      });

      return loadDashboard({
        db: ctx.db,
        focus: "MOBILE",
        viewer: ctx.viewer,
      });
    }),

  clockOut: protectedProcedure
    .input(clockActionInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertFaceEnrollment(ctx.viewer);
      assertFaceMatch(input.faceScan);

      const openTimesheet = await findViewerOpenTimesheet({
        db: ctx.db,
        viewer: ctx.viewer,
      });

      if (!openTimesheet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active shift was found to clock out from.",
        });
      }

      if (openTimesheet.status === TimesheetStatus.ON_BREAK) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "End the active break before clocking out.",
        });
      }

      await ctx.db.timesheet.update({
        data: {
          clockOutAt: new Date(input.faceScan.capturedAt),
          faceConfidence: input.faceScan.confidence,
          faceVerified: true,
          notes: input.note ?? openTimesheet.notes,
          status: TimesheetStatus.CLOCKED_OUT,
        },
        where: {
          id: openTimesheet.id,
        },
      });

      await recalculateTimesheet({
        db: ctx.db,
        timesheetId: openTimesheet.id,
      });

      await createAudit(ctx.db, {
        action: "timesheet.clock_out",
        actorId: ctx.viewer.id,
        companyId: ctx.viewer.companyId,
        entityId: openTimesheet.id,
        entityType: "Timesheet",
        summary: `${ctx.viewer.name} clocked out and payroll totals were recalculated.`,
      });

      return loadDashboard({
        db: ctx.db,
        focus: "MOBILE",
        viewer: ctx.viewer,
      });
    }),

  dashboard: protectedProcedure
    .input(dashboardInputSchema)
    .query(({ ctx, input }) =>
      loadDashboard({
        db: ctx.db,
        focus: input.focus,
        viewer: ctx.viewer,
      }),
    ),

  enrollFace: protectedProcedure
    .input(enrollFaceInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertFaceMatch(input.faceScan);

      const updatedViewer = await ctx.db.user.update({
        data: {
          faceEnrolled: true,
          faceEnrollmentCapturedAt: new Date(input.faceScan.capturedAt),
          faceEnrollmentConfidence: input.faceScan.confidence,
          faceTemplateHash: buildFaceTemplateHash({
            faceScan: input.faceScan,
            userId: ctx.viewer.id,
          }),
        },
        include: {
          company: true,
          team: true,
        },
        where: {
          id: ctx.viewer.id,
        },
      });

      await createAudit(ctx.db, {
        action: "face.enrolled",
        actorId: ctx.viewer.id,
        companyId: ctx.viewer.companyId,
        entityId: ctx.viewer.id,
        entityType: "User",
        summary: `${ctx.viewer.name} created their first secure face scan.`,
      });

      return loadDashboard({
        db: ctx.db,
        focus: "MOBILE",
        viewer: updatedViewer,
      });
    }),
  endBreak: protectedProcedure
    .input(breakActionInputSchema)
    .mutation(async ({ ctx }) => {
      const openTimesheet = await findViewerOpenTimesheet({
        db: ctx.db,
        viewer: ctx.viewer,
      });

      if (!openTimesheet || openTimesheet.status !== TimesheetStatus.ON_BREAK) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active break is currently running.",
        });
      }

      const currentBreak = openTimesheet.breaks.find((entry) => !entry.endAt);

      if (!currentBreak) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Unable to find the open break segment.",
        });
      }

      await ctx.db.breakEntry.update({
        data: {
          endAt: new Date(),
        },
        where: {
          id: currentBreak.id,
        },
      });

      await ctx.db.timesheet.update({
        data: {
          status: TimesheetStatus.CLOCKED_IN,
        },
        where: {
          id: openTimesheet.id,
        },
      });

      return loadDashboard({
        db: ctx.db,
        focus: "MOBILE",
        viewer: ctx.viewer,
      });
    }),

  payrollPreview: managerProcedure
    .input(payrollPreviewInputSchema)
    .query(({ ctx, input }) =>
      buildPayrollPreview({
        db: ctx.db,
        frequency: input.frequency,
        viewer: ctx.viewer,
      }),
    ),

  requestCorrection: protectedProcedure
    .input(correctionRequestInputSchema)
    .mutation(async ({ ctx, input }) => {
      const timesheet = await ctx.db.timesheet.findUniqueOrThrow({
        include: {
          user: true,
        },
        where: {
          id: input.timesheetId,
        },
      });

      if (
        ctx.viewer.role === "EMPLOYEE" &&
        timesheet.userId !== ctx.viewer.id
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const correction = await ctx.db.timeCorrection.create({
        data: {
          companyId: ctx.viewer.companyId,
          reason: input.reason,
          reference: `CR-${ctx.viewer.id}-${Date.now()}`,
          requestedClockInAt: input.requestedClockInAt
            ? new Date(input.requestedClockInAt)
            : null,
          requestedClockOutAt: input.requestedClockOutAt
            ? new Date(input.requestedClockOutAt)
            : null,
          timesheetId: input.timesheetId,
          userId: timesheet.userId,
        },
      });

      await ctx.db.timesheet.update({
        data: {
          status: TimesheetStatus.FLAGGED,
        },
        where: {
          id: input.timesheetId,
        },
      });

      await createAudit(ctx.db, {
        action: "correction.requested",
        actorId: ctx.viewer.id,
        companyId: ctx.viewer.companyId,
        entityId: correction.id,
        entityType: "TimeCorrection",
        summary: `${ctx.viewer.name} requested a manual correction for a payroll event.`,
      });

      return loadDashboard({
        db: ctx.db,
        focus: "MOBILE",
        viewer: ctx.viewer,
      });
    }),

  requestLeave: protectedProcedure
    .input(leaveRequestInputSchema)
    .mutation(async ({ ctx, input }) => {
      const start = startOfDay(new Date(input.startDate));
      const end = endOfDay(new Date(input.endDate));
      const daySpan =
        Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) +
        1;

      const leave = await ctx.db.leaveRequest.create({
        data: {
          companyId: ctx.viewer.companyId,
          endDate: end,
          hours:
            input.hours ??
            daySpan * Math.max(ctx.viewer.company.standardDayHours, 1),
          reason: input.reason,
          reference: `LV-${ctx.viewer.id}-${Date.now()}`,
          startDate: start,
          type: input.type,
          userId: ctx.viewer.id,
        },
      });

      await createAudit(ctx.db, {
        action: "leave.requested",
        actorId: ctx.viewer.id,
        companyId: ctx.viewer.companyId,
        entityId: leave.id,
        entityType: "LeaveRequest",
        summary: `${ctx.viewer.name} submitted a ${input.type.toLowerCase()} leave request.`,
      });

      return loadDashboard({
        db: ctx.db,
        focus: "MOBILE",
        viewer: ctx.viewer,
      });
    }),

  reviewCorrection: managerProcedure
    .input(reviewCorrectionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const correction = await ctx.db.timeCorrection.findUniqueOrThrow({
        include: {
          timesheet: {
            include: {
              breaks: true,
              shift: true,
              user: true,
            },
          },
          user: true,
        },
        where: {
          id: input.correctionId,
        },
      });

      if (
        ctx.viewer.role === "MANAGER" &&
        correction.user.teamId !== ctx.viewer.teamId
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db.timeCorrection.update({
        data: {
          resolutionNote: input.resolutionNote,
          reviewedAt: new Date(),
          reviewerId: ctx.viewer.id,
          status: input.status,
        },
        where: {
          id: input.correctionId,
        },
      });

      if (input.status === "APPROVED" && correction.timesheet) {
        await ctx.db.timesheet.update({
          data: {
            clockInAt:
              correction.requestedClockInAt ?? correction.timesheet.clockInAt,
            clockOutAt:
              correction.requestedClockOutAt ?? correction.timesheet.clockOutAt,
            status: TimesheetStatus.CLOCKED_OUT,
          },
          where: {
            id: correction.timesheet.id,
          },
        });

        await recalculateTimesheet({
          db: ctx.db,
          timesheetId: correction.timesheet.id,
        });
      }

      await createAudit(ctx.db, {
        action: "correction.reviewed",
        actorId: ctx.viewer.id,
        companyId: ctx.viewer.companyId,
        entityId: correction.id,
        entityType: "TimeCorrection",
        summary: `${ctx.viewer.name} ${input.status === "APPROVED" ? "approved" : "rejected"} a time correction request.`,
      });

      return loadDashboard({
        db: ctx.db,
        focus: "OPS",
        viewer: ctx.viewer,
      });
    }),

  reviewLeave: managerProcedure
    .input(reviewLeaveInputSchema)
    .mutation(async ({ ctx, input }) => {
      const leave = await ctx.db.leaveRequest.findUniqueOrThrow({
        include: {
          user: true,
        },
        where: {
          id: input.leaveRequestId,
        },
      });

      if (
        ctx.viewer.role === "MANAGER" &&
        leave.user.teamId !== ctx.viewer.teamId
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db.leaveRequest.update({
        data: {
          approverId: ctx.viewer.id,
          comment: input.comment,
          reviewedAt: new Date(),
          status: input.status,
        },
        where: {
          id: input.leaveRequestId,
        },
      });

      if (input.status === "APPROVED") {
        await ctx.db.user.update({
          data: {
            leaveBalanceDays: Math.max(
              leave.user.leaveBalanceDays -
                leave.hours / ctx.viewer.company.standardDayHours,
              0,
            ),
          },
          where: {
            id: leave.userId,
          },
        });
      }

      await createAudit(ctx.db, {
        action: "leave.reviewed",
        actorId: ctx.viewer.id,
        companyId: ctx.viewer.companyId,
        entityId: leave.id,
        entityType: "LeaveRequest",
        summary: `${ctx.viewer.name} ${input.status === "APPROVED" ? "approved" : "declined"} a leave request.`,
      });

      return loadDashboard({
        db: ctx.db,
        focus: "OPS",
        viewer: ctx.viewer,
      });
    }),

  startBreak: protectedProcedure
    .input(breakActionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const openTimesheet = await findViewerOpenTimesheet({
        db: ctx.db,
        viewer: ctx.viewer,
      });

      if (!openTimesheet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active shift is running for break tracking.",
        });
      }

      if (openTimesheet.status === TimesheetStatus.ON_BREAK) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A break is already active.",
        });
      }

      await ctx.db.breakEntry.create({
        data: {
          reason: input.note,
          startAt: new Date(),
          timesheetId: openTimesheet.id,
        },
      });

      await ctx.db.timesheet.update({
        data: {
          status: TimesheetStatus.ON_BREAK,
        },
        where: {
          id: openTimesheet.id,
        },
      });

      return loadDashboard({
        db: ctx.db,
        focus: "MOBILE",
        viewer: ctx.viewer,
      });
    }),
} satisfies TRPCRouterRecord;
