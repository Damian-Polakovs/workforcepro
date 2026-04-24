import type { PrismaClient } from "@prisma/client";
import {
  CorrectionStatus,
  EmploymentType,
  LeaveStatus,
  LeaveType,
  PayrollFrequency,
  ShiftStatus,
  TimesheetStatus,
  UserRole,
} from "@prisma/client";

import { DEFAULT_ADMIN_EMAIL, defaultDemoProfiles } from "@acme/validators";

import {
  addDays,
  calculateTimesheetMetrics,
  endOfDay,
  startOfDay,
} from "./workforce";

const COMPANY_NAME = "WorkForcePro";

const hoursFrom = (base: Date, hours: number) =>
  new Date(base.getTime() + hours * 60 * 60 * 1000);

let bootstrapPromise: Promise<void> | null = null;

export async function ensureDemoDataOnce(prisma: PrismaClient) {
  bootstrapPromise ??= ensureDemoData(prisma);
  await bootstrapPromise;
}

export async function ensureDemoData(prisma: PrismaClient) {
  const existingAdmin = await prisma.user.findUnique({
    where: { email: DEFAULT_ADMIN_EMAIL },
    select: { id: true },
  });

  if (existingAdmin) {
    return;
  }

  const now = new Date();
  const today = startOfDay(now);

  const company = await prisma.company.create({
    data: {
      bankHolidayMultiplier: 2,
      currency: "EUR",
      name: COMPANY_NAME,
      overtimeDailyThreshold: 8,
      overtimeMultiplier: 1.5,
      overtimeWeeklyThreshold: 40,
      payrollFrequency: PayrollFrequency.WEEKLY,
      standardDayHours: 8,
      standardWeekHours: 40,
      timezone: "Europe/Dublin",
    },
  });

  const operations = await prisma.team.create({
    data: {
      code: "OPS",
      color: "#FF764A",
      companyId: company.id,
      name: "Operations",
    },
  });

  const support = await prisma.team.create({
    data: {
      code: "SUP",
      color: "#0096C7",
      companyId: company.id,
      name: "Customer Support",
    },
  });

  const payroll = await prisma.team.create({
    data: {
      code: "PAY",
      color: "#7A9E45",
      companyId: company.id,
      name: "Payroll & Compliance",
    },
  });

  const users = {
    admin: await prisma.user.create({
      data: {
        active: true,
        avatarInitials: "OB",
        companyId: company.id,
        email: defaultDemoProfiles[0].email,
        employmentType: EmploymentType.FULL_TIME,
        faceEnrolled: false,
        hireDate: addDays(today, -780),
        hourlyRate: 39,
        leaveBalanceDays: 18,
        name: defaultDemoProfiles[0].name,
        role: UserRole.ADMIN,
        standardHoursPerWeek: 40,
        teamId: payroll.id,
      },
    }),
    manager: await prisma.user.create({
      data: {
        active: true,
        avatarInitials: "MD",
        companyId: company.id,
        email: defaultDemoProfiles[1].email,
        employmentType: EmploymentType.FULL_TIME,
        faceEnrolled: false,
        hireDate: addDays(today, -620),
        hourlyRate: 31,
        leaveBalanceDays: 14,
        name: defaultDemoProfiles[1].name,
        role: UserRole.MANAGER,
        standardHoursPerWeek: 40,
        teamId: operations.id,
      },
    }),
    aisha: await prisma.user.create({
      data: {
        active: true,
        avatarInitials: "AK",
        companyId: company.id,
        email: defaultDemoProfiles[2].email,
        employmentType: EmploymentType.FULL_TIME,
        faceEnrolled: false,
        hireDate: addDays(today, -340),
        hourlyRate: 22,
        leaveBalanceDays: 10,
        name: defaultDemoProfiles[2].name,
        role: UserRole.EMPLOYEE,
        standardHoursPerWeek: 40,
        teamId: operations.id,
      },
    }),
    liam: await prisma.user.create({
      data: {
        active: true,
        avatarInitials: "LM",
        companyId: company.id,
        email: defaultDemoProfiles[3].email,
        employmentType: EmploymentType.FULL_TIME,
        faceEnrolled: false,
        hireDate: addDays(today, -420),
        hourlyRate: 24,
        leaveBalanceDays: 7,
        name: defaultDemoProfiles[3].name,
        role: UserRole.EMPLOYEE,
        standardHoursPerWeek: 40,
        teamId: support.id,
      },
    }),
    sofia: await prisma.user.create({
      data: {
        active: true,
        avatarInitials: "SW",
        companyId: company.id,
        email: defaultDemoProfiles[4].email,
        employmentType: EmploymentType.PART_TIME,
        faceEnrolled: false,
        hireDate: addDays(today, -240),
        hourlyRate: 20,
        leaveBalanceDays: 6,
        name: defaultDemoProfiles[4].name,
        role: UserRole.EMPLOYEE,
        standardHoursPerWeek: 24,
        teamId: operations.id,
      },
    }),
  };

  const shiftAishaToday = await prisma.shift.create({
    data: {
      assignedToId: users.aisha.id,
      code: "SHIFT-AISHA-TODAY",
      companyId: company.id,
      createdById: users.manager.id,
      endTime: hoursFrom(now, 7),
      notes: "High-volume dispatch window with lunch cover.",
      premiumMultiplier: 1,
      publishedAt: addDays(now, -2),
      startTime: hoursFrom(now, -1),
      status: ShiftStatus.PUBLISHED,
      teamId: operations.id,
      title: "Dispatch control",
      unpaidBreakMinutes: 30,
    },
  });

  const shiftLiamTonight = await prisma.shift.create({
    data: {
      assignedToId: users.liam.id,
      code: "SHIFT-LIAM-OVERNIGHT",
      companyId: company.id,
      createdById: users.manager.id,
      endTime: hoursFrom(now, 14),
      notes: "Overnight overflow and hotline cover.",
      premiumMultiplier: 1.15,
      publishedAt: addDays(now, -2),
      startTime: hoursFrom(now, 6),
      status: ShiftStatus.PUBLISHED,
      teamId: support.id,
      title: "Night support",
      unpaidBreakMinutes: 45,
    },
  });

  const shiftSofiaTomorrow = await prisma.shift.create({
    data: {
      assignedToId: users.sofia.id,
      code: "SHIFT-SOFIA-TOMORROW",
      companyId: company.id,
      createdById: users.manager.id,
      endTime: hoursFrom(addDays(today, 1), 16),
      notes: "Midweek roster with compliance handoff.",
      premiumMultiplier: 1,
      publishedAt: addDays(now, -2),
      startTime: hoursFrom(addDays(today, 1), 8),
      status: ShiftStatus.PUBLISHED,
      teamId: operations.id,
      title: "Store floor coverage",
      unpaidBreakMinutes: 30,
    },
  });

  const approvedShift = await prisma.shift.create({
    data: {
      assignedToId: users.aisha.id,
      code: "SHIFT-AISHA-YESTERDAY",
      companyId: company.id,
      createdById: users.manager.id,
      endTime: hoursFrom(addDays(today, -1), 17.5),
      notes: "Banking and close-out duties.",
      premiumMultiplier: 1,
      publishedAt: addDays(now, -3),
      startTime: hoursFrom(addDays(today, -1), 8.5),
      status: ShiftStatus.COMPLETED,
      teamId: operations.id,
      title: "Front office",
      unpaidBreakMinutes: 30,
    },
  });

  const overtimeShift = await prisma.shift.create({
    data: {
      assignedToId: users.liam.id,
      code: "SHIFT-LIAM-BANK-HOLIDAY",
      companyId: company.id,
      createdById: users.manager.id,
      endTime: hoursFrom(addDays(today, -2), 20),
      bankHoliday: true,
      notes: "Bank holiday escalation desk.",
      premiumMultiplier: 1.1,
      publishedAt: addDays(now, -5),
      startTime: hoursFrom(addDays(today, -2), 8),
      status: ShiftStatus.COMPLETED,
      teamId: support.id,
      title: "Holiday support",
      unpaidBreakMinutes: 30,
    },
  });

  const approvedBreaks = [
    {
      endAt: hoursFrom(addDays(today, -1), 13),
      startAt: hoursFrom(addDays(today, -1), 12.5),
    },
  ];

  const approvedMetrics = calculateTimesheetMetrics({
    bankHoliday: false,
    bankHolidayMultiplier: company.bankHolidayMultiplier,
    breaks: approvedBreaks,
    clockInAt: hoursFrom(addDays(today, -1), 8.58),
    clockOutAt: hoursFrom(addDays(today, -1), 17.5),
    hourlyRate: users.aisha.hourlyRate,
    overtimeDailyThresholdHours: company.overtimeDailyThreshold,
    overtimeMultiplier: company.overtimeMultiplier,
    premiumMultiplier: approvedShift.premiumMultiplier,
    scheduledEnd: approvedShift.endTime,
    scheduledStart: approvedShift.startTime,
  });

  await prisma.timesheet.create({
    data: {
      approvalSignature: "Marcus Doyle",
      approvedAt: addDays(now, -1),
      approvedById: users.manager.id,
      breakMinutes: approvedMetrics.breakMinutes,
      breaks: {
        create: approvedBreaks,
      },
      clockInAt: hoursFrom(addDays(today, -1), 8.58),
      clockOutAt: hoursFrom(addDays(today, -1), 17.5),
      companyId: company.id,
      earlyDepartureMinutes: approvedMetrics.earlyDepartureMinutes,
      faceConfidence: 0.94,
      faceVerified: true,
      grossPay: approvedMetrics.grossPay,
      lateMinutes: approvedMetrics.lateMinutes,
      notes: "Approved after manager review.",
      overtimeMinutes: approvedMetrics.overtimeMinutes,
      reference: "TS-AISHA-YESTERDAY",
      regularMinutes: approvedMetrics.regularMinutes,
      shiftId: approvedShift.id,
      status: TimesheetStatus.APPROVED,
      userId: users.aisha.id,
      workDate: addDays(today, -1),
    },
  });

  const overtimeBreaks = [
    {
      endAt: hoursFrom(addDays(today, -2), 13),
      startAt: hoursFrom(addDays(today, -2), 12.5),
    },
    {
      endAt: hoursFrom(addDays(today, -2), 17.2),
      startAt: hoursFrom(addDays(today, -2), 17),
    },
  ];

  const overtimeMetrics = calculateTimesheetMetrics({
    bankHoliday: true,
    bankHolidayMultiplier: company.bankHolidayMultiplier,
    breaks: overtimeBreaks,
    clockInAt: hoursFrom(addDays(today, -2), 7.92),
    clockOutAt: hoursFrom(addDays(today, -2), 20.25),
    hourlyRate: users.liam.hourlyRate,
    overtimeDailyThresholdHours: company.overtimeDailyThreshold,
    overtimeMultiplier: company.overtimeMultiplier,
    premiumMultiplier: overtimeShift.premiumMultiplier,
    scheduledEnd: overtimeShift.endTime,
    scheduledStart: overtimeShift.startTime,
  });

  await prisma.timesheet.create({
    data: {
      approvalSignature: "Marcus Doyle",
      approvedAt: addDays(now, -2),
      approvedById: users.manager.id,
      breakMinutes: overtimeMetrics.breakMinutes,
      breaks: {
        create: overtimeBreaks,
      },
      clockInAt: hoursFrom(addDays(today, -2), 7.92),
      clockOutAt: hoursFrom(addDays(today, -2), 20.25),
      companyId: company.id,
      earlyDepartureMinutes: overtimeMetrics.earlyDepartureMinutes,
      faceConfidence: 0.91,
      faceVerified: true,
      grossPay: overtimeMetrics.grossPay,
      lateMinutes: overtimeMetrics.lateMinutes,
      notes: "Holiday premium applied automatically.",
      overtimeMinutes: overtimeMetrics.overtimeMinutes,
      reference: "TS-LIAM-HOLIDAY",
      regularMinutes: overtimeMetrics.regularMinutes,
      shiftId: overtimeShift.id,
      status: TimesheetStatus.APPROVED,
      userId: users.liam.id,
      workDate: addDays(today, -2),
    },
  });

  await prisma.timesheet.create({
    data: {
      breakMinutes: 0,
      clockInAt: hoursFrom(now, -0.92),
      companyId: company.id,
      faceConfidence: 0.97,
      faceVerified: true,
      notes: "Face match passed. Active shift in progress.",
      reference: "TS-AISHA-TODAY",
      shiftId: shiftAishaToday.id,
      status: TimesheetStatus.CLOCKED_IN,
      userId: users.aisha.id,
      workDate: today,
    },
  });

  await prisma.leaveRequest.createMany({
    data: [
      {
        approverId: users.manager.id,
        comment: "Approved with return-to-work note.",
        companyId: company.id,
        endDate: endOfDay(addDays(today, -3)),
        hours: 8,
        reason: "Certified recovery day after medical appointment.",
        reference: "LV-LIAM-SICK",
        reviewedAt: addDays(now, -4),
        startDate: startOfDay(addDays(today, -3)),
        status: LeaveStatus.APPROVED,
        type: LeaveType.SICK,
        userId: users.liam.id,
      },
      {
        companyId: company.id,
        endDate: endOfDay(addDays(today, 3)),
        hours: 16,
        reason: "Annual leave request for family travel.",
        reference: "LV-SOFIA-ANNUAL",
        startDate: startOfDay(addDays(today, 2)),
        status: LeaveStatus.PENDING,
        type: LeaveType.ANNUAL,
        userId: users.sofia.id,
      },
    ],
  });

  await prisma.timeCorrection.create({
    data: {
      companyId: company.id,
      reason: "Forgot to clock out after closing checklist.",
      reference: "CR-AISHA-CLOSE",
      requestedClockInAt: hoursFrom(addDays(today, -1), 8.58),
      requestedClockOutAt: hoursFrom(addDays(today, -1), 17.75),
      status: CorrectionStatus.PENDING,
      timesheetId: (
        await prisma.timesheet.findUniqueOrThrow({
          where: { reference: "TS-AISHA-YESTERDAY" },
          select: { id: true },
        })
      ).id,
      userId: users.aisha.id,
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        action: "timesheet.approved",
        actorId: users.manager.id,
        companyId: company.id,
        entityId: "TS-AISHA-YESTERDAY",
        entityType: "Timesheet",
        summary: "Marcus Doyle approved Aisha Khan's close-of-day timesheet.",
      },
      {
        action: "leave.requested",
        actorId: users.sofia.id,
        companyId: company.id,
        entityId: "LV-SOFIA-ANNUAL",
        entityType: "LeaveRequest",
        summary: "Sofia Walsh requested two days of annual leave.",
      },
      {
        action: "schedule.published",
        actorId: users.manager.id,
        companyId: company.id,
        entityId: shiftSofiaTomorrow.id,
        entityType: "Shift",
        summary: "Marcus Doyle published the next 48-hour roster.",
      },
      {
        action: "timesheet.flagged",
        actorId: users.aisha.id,
        companyId: company.id,
        entityId: "CR-AISHA-CLOSE",
        entityType: "TimeCorrection",
        summary:
          "Aisha Khan submitted a correction for a missed clock-out event.",
      },
    ],
  });

  void shiftLiamTonight;
}
