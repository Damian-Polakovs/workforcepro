import type {
  BreakEntry,
  PayrollFrequency,
  Shift,
  Timesheet,
} from "@prisma/client";

const MINUTE_IN_MS = 60_000;
const HOUR_IN_MINUTES = 60;

type BreakWindow = Pick<BreakEntry, "startAt" | "endAt">;

export interface TimesheetCalculationInput {
  bankHoliday: boolean;
  bankHolidayMultiplier: number;
  breaks: BreakWindow[];
  clockInAt: Date;
  clockOutAt: Date;
  hourlyRate: number;
  overtimeDailyThresholdHours: number;
  overtimeMultiplier: number;
  premiumMultiplier?: number;
  scheduledEnd?: Date | null;
  scheduledStart?: Date | null;
}

export const roundCurrency = (value: number) => Number(value.toFixed(2));

export const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * HOUR_IN_MINUTES * MINUTE_IN_MS);

export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const endOfDay = (date: Date) => {
  const value = startOfDay(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

export const minutesBetween = (start: Date, end: Date) =>
  Math.max(Math.round((end.getTime() - start.getTime()) / MINUTE_IN_MS), 0);

export const calculateBreakMinutes = (breaks: BreakWindow[]) =>
  breaks.reduce((total, entry) => {
    if (!entry.endAt) {
      return total;
    }

    return total + minutesBetween(entry.startAt, entry.endAt);
  }, 0);

export function calculateTimesheetMetrics(input: TimesheetCalculationInput) {
  const breakMinutes = calculateBreakMinutes(input.breaks);
  const workedMinutes =
    minutesBetween(input.clockInAt, input.clockOutAt) - breakMinutes;
  const cappedWorkedMinutes = Math.max(workedMinutes, 0);
  const overtimeThresholdMinutes =
    input.overtimeDailyThresholdHours * HOUR_IN_MINUTES;
  const overtimeMinutes = Math.max(
    cappedWorkedMinutes - overtimeThresholdMinutes,
    0,
  );
  const regularMinutes = Math.max(cappedWorkedMinutes - overtimeMinutes, 0);
  const premiumFactor =
    (input.bankHoliday ? input.bankHolidayMultiplier : 1) *
    (input.premiumMultiplier ?? 1);
  const regularPay =
    (regularMinutes / HOUR_IN_MINUTES) * input.hourlyRate * premiumFactor;
  const overtimePay =
    (overtimeMinutes / HOUR_IN_MINUTES) *
    input.hourlyRate *
    input.overtimeMultiplier *
    premiumFactor;

  return {
    breakMinutes,
    earlyDepartureMinutes:
      input.scheduledEnd && input.clockOutAt < input.scheduledEnd
        ? minutesBetween(input.clockOutAt, input.scheduledEnd)
        : 0,
    grossPay: roundCurrency(regularPay + overtimePay),
    lateMinutes:
      input.scheduledStart && input.clockInAt > input.scheduledStart
        ? minutesBetween(input.scheduledStart, input.clockInAt)
        : 0,
    overtimeMinutes,
    regularMinutes,
    workedMinutes: cappedWorkedMinutes,
  };
}

export const formatDisplayDate = (value: Date) =>
  value.toLocaleDateString("en-IE", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  });

export const formatDisplayTime = (value: Date) =>
  value.toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
  });

export function getPayrollPeriodRange(
  referenceDate: Date,
  frequency: PayrollFrequency,
) {
  const anchor = startOfDay(referenceDate);

  if (frequency === "MONTHLY") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = endOfDay(
      new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0),
    );
    return { start, end };
  }

  const dayOfWeek = (anchor.getDay() + 6) % 7;
  const start = addDays(anchor, -dayOfWeek);
  const span = frequency === "FORTNIGHTLY" ? 13 : 6;

  return {
    end: endOfDay(addDays(start, span)),
    start,
  };
}

export function buildPayrollCsv(
  rows: {
    employee: string;
    grossPay: number;
    overtimeHours: number;
    regularHours: number;
  }[],
) {
  const header = "Employee,Regular Hours,Overtime Hours,Gross Pay";
  const lines = rows.map(
    (row) =>
      `${row.employee},${row.regularHours.toFixed(2)},${row.overtimeHours.toFixed(2)},${row.grossPay.toFixed(2)}`,
  );

  return [header, ...lines].join("\n");
}

export const isTimesheetOpen = (timesheet: Pick<Timesheet, "status">) =>
  timesheet.status === "CLOCKED_IN" || timesheet.status === "ON_BREAK";

export const shiftLabel = (
  shift: Pick<Shift, "title" | "startTime" | "endTime">,
) =>
  `${shift.title} - ${formatDisplayTime(shift.startTime)}-${formatDisplayTime(shift.endTime)}`;
