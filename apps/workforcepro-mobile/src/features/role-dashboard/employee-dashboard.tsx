import { useEffect, useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { EmployeeActions } from "./shared";
import type { DashboardData, DashboardTimesheet } from "~/types/api";
import { trpc } from "~/utils/api";
import {
  ActionButton,
  clockLabel,
  compactShiftTime,
  employeeLeaveRows,
  EmptyState,
  formatDateRange,
  IconBadge,
  KeyValue,
  latestTimesheet,
  MetricTile,
  money,
  Pill,
  ScreenTitle,
  SectionCard,
  shiftHours,
  showInfo,
  StatusRow,
  styles,
  timesheetRange,
  toTitleCase,
} from "./shared";

const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const leaveTypes = ["ANNUAL", "SICK", "MEDICAL", "PERSONAL", "UNPAID"] as const;

function dateInputFromDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toTimestamp(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function calculateActiveWorkedMs(
  timesheet: DashboardTimesheet | null,
  now: number,
) {
  const clockInAt = toTimestamp(timesheet?.clockInAt);
  if (!timesheet || clockInAt === null || timesheet.clockOutAt) {
    return 0;
  }

  return Math.max(now - clockInAt - timesheet.breakMinutes * minuteMs, 0);
}

function formatWorkedDuration(milliseconds: number) {
  const totalMinutes = Math.max(Math.floor(milliseconds / minuteMs), 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function EmployeeDashboard(props: {
  actions: EmployeeActions;
  activeTab: string;
  dashboard: DashboardData;
}) {
  if (props.activeTab === "rota") {
    return <EmployeeRotaScreen dashboard={props.dashboard} />;
  }
  if (props.activeTab === "leave") {
    return <EmployeeLeaveScreen dashboard={props.dashboard} />;
  }
  if (props.activeTab === "pay") {
    return <EmployeePayScreen dashboard={props.dashboard} />;
  }
  return (
    <EmployeeHomeScreen actions={props.actions} dashboard={props.dashboard} />
  );
}

function EmployeeHomeScreen(props: {
  actions: EmployeeActions;
  dashboard: DashboardData;
}) {
  const firstName = props.dashboard.viewer.name.split(" ")[0] ?? "there";
  const latest = latestTimesheet(props.dashboard);
  const activeTimesheet = props.dashboard.today.activeTimesheet;
  const activeClockRunning = Boolean(
    activeTimesheet?.clockInAt && !activeTimesheet.clockOutAt,
  );
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const onTime = props.dashboard.stats.punctualityScore >= 80;
  const breakLabel =
    props.dashboard.today.status === "ON_BREAK" ? "End break" : "Break";
  const activeWorkedMs = calculateActiveWorkedMs(activeTimesheet, timerNow);
  const liveCycleHours =
    props.dashboard.stats.hoursThisCycle + activeWorkedMs / hourMs;
  const hoursTarget = Math.max(props.dashboard.company.standardWeekHours, 1);
  const hoursProgress = Math.min(
    (liveCycleHours / hoursTarget) * 100,
    100,
  );
  const latestWorkedMs = latest ? latest.workedHours * hourMs : 0;
  const workedTimerValue = activeClockRunning
    ? formatWorkedDuration(activeWorkedMs)
    : formatWorkedDuration(latestWorkedMs);
  const workedTimerDetail = activeClockRunning
    ? "Counting from your clock-in face scan"
    : latest
      ? "Last completed face-scan shift"
      : "Your timer starts after clock-in face scan";

  useEffect(() => {
    if (!activeClockRunning) {
      return;
    }

    setTimerNow(Date.now());
    const timer = setInterval(() => {
      setTimerNow(Date.now());
    }, 30_000);

    return () => clearInterval(timer);
  }, [activeClockRunning, activeTimesheet?.clockInAt]);

  return (
    <View style={styles.stack}>
      <ScreenTitle title={`Hello, ${firstName}`} />
      <View style={styles.scanCard}>
        <View style={styles.scanRing}>
          <View style={styles.scanAvatar}>
            <Text style={styles.scanInitials}>
              {props.dashboard.viewer.avatarInitials}
            </Text>
          </View>
        </View>
        <Text style={styles.scanText}>
          {props.dashboard.viewer.faceEnrolled
            ? "Face profile enrolled"
            : "Face enrollment required"}
        </Text>
      </View>
      <View style={styles.buttonRow}>
        <ActionButton
          disabled={props.actions.busy}
          label={clockLabel(props.dashboard)}
          onPress={props.actions.clock}
          style={styles.flexButton}
          variant="primary"
        />
        <ActionButton
          disabled={props.actions.busy}
          label={breakLabel}
          onPress={props.actions.breakAction}
          style={styles.flexButton}
        />
      </View>
      <SectionCard title="Today's shift">
        {props.dashboard.today.shift ? (
          <View style={styles.titleRow}>
            <Text style={styles.bigValue}>
              {shiftHours(props.dashboard.today.shift)}
            </Text>
            <Pill
              label={toTitleCase(props.dashboard.today.status)}
              tone={onTime ? "success" : "warning"}
            />
          </View>
        ) : latest ? (
          <StatusRow
            label={latest.label}
            onPress={() =>
              showInfo("Latest timesheet", [
                ["Reference", latest.reference],
                ["Clock", timesheetRange(latest)],
                ["Status", toTitleCase(latest.status)],
                ["Worked hours", `${latest.workedHours}h`],
              ])
            }
            status={timesheetRange(latest)}
            tone="info"
          />
        ) : (
          <EmptyState
            detail="No current shift or recent timesheet was returned."
            title="No shift today"
          />
        )}
      </SectionCard>
      <SectionCard title="Worked time">
        <View style={styles.titleRow}>
          <Text style={styles.bigValue}>{workedTimerValue}</Text>
          <Pill
            label={activeClockRunning ? "Live" : "Total"}
            tone={activeClockRunning ? "success" : "info"}
          />
        </View>
        <Text style={styles.mutedText}>{workedTimerDetail}</Text>
      </SectionCard>
      <SectionCard title="Hours this cycle">
        <Text style={styles.bigValue}>
          {liveCycleHours.toFixed(1)} / {hoursTarget}h
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${hoursProgress}%` }]} />
        </View>
      </SectionCard>
    </View>
  );
}

function EmployeeRotaScreen(props: { dashboard: DashboardData }) {
  const shifts = props.dashboard.upcomingShifts;
  const queryClient = useQueryClient();
  const latest = latestTimesheet(props.dashboard);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionReason, setCorrectionReason] = useState(
    "Missed clock-out after handover and closing checks.",
  );
  const [requestedClockOutAt, setRequestedClockOutAt] = useState("");
  const correctionMutation = useMutation(
    trpc.workforce.requestCorrection.mutationOptions({
      onSuccess: async () => {
        setCorrectionOpen(false);
        await queryClient.invalidateQueries(
          trpc.workforce.dashboard.queryFilter(),
        );
      },
    }),
  );

  const submitCorrection = () => {
    if (!latest || correctionMutation.isPending) {
      return;
    }

    correctionMutation.mutate({
      reason: correctionReason,
      requestedClockOutAt: requestedClockOutAt.trim() || undefined,
      timesheetId: latest.id,
    });
  };

  return (
    <View style={styles.stack}>
      <ScreenTitle title="My rota" />
      <SectionCard title="Upcoming shifts">
        {shifts.length ? (
          shifts.map((shift) => (
            <StatusRow
              key={shift.id}
              label={shift.label}
              onPress={() =>
                showInfo("Shift", [
                  ["Label", shift.label],
                  ["Team", shift.team],
                  ["Dates", formatDateRange(shift.startTime, shift.endTime)],
                  ["Time", compactShiftTime(shift)],
                  ["Status", toTitleCase(shift.status)],
                  ["Premium multiplier", `x${shift.premiumMultiplier}`],
                ])
              }
              status={compactShiftTime(shift)}
              tone="info"
            />
          ))
        ) : (
          <EmptyState
            detail="Published shifts will appear when the roster API returns them."
            title="No upcoming shifts"
          />
        )}
      </SectionCard>
      <ActionButton
        disabled={!latest || correctionMutation.isPending}
        label="Request time correction"
        onPress={() => setCorrectionOpen(true)}
        variant="primary"
      />
      <FormModal
        actionLabel={
          correctionMutation.isPending ? "Submitting..." : "Submit correction"
        }
        errorMessage={correctionMutation.error?.message}
        onCancel={() => setCorrectionOpen(false)}
        onSubmit={submitCorrection}
        submitDisabled={
          !latest ||
          correctionReason.trim().length < 12 ||
          correctionMutation.isPending
        }
        title="Request time correction"
        visible={correctionOpen}
      >
        <Text style={formStyles.helperText}>
          {latest
            ? `${latest.reference} - ${timesheetRange(latest)}`
            : "No timesheet is available."}
        </Text>
        <Text style={formStyles.label}>Reason</Text>
        <TextInput
          multiline
          onChangeText={setCorrectionReason}
          style={[formStyles.input, formStyles.textArea]}
          value={correctionReason}
        />
        <Text style={formStyles.label}>Requested clock-out ISO time</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={setRequestedClockOutAt}
          placeholder="2026-04-25T18:00:00.000Z"
          placeholderTextColor="#64748b"
          style={formStyles.input}
          value={requestedClockOutAt}
        />
      </FormModal>
    </View>
  );
}

function EmployeeLeaveScreen(props: { dashboard: DashboardData }) {
  const leaveRows = employeeLeaveRows(props.dashboard.pendingLeave);
  const pendingLeave = props.dashboard.pendingLeave.filter(
    (leave) => leave.status === "PENDING",
  ).length;
  const queryClient = useQueryClient();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveType, setLeaveType] =
    useState<(typeof leaveTypes)[number]>("ANNUAL");
  const [startDate, setStartDate] = useState(() => dateInputFromDate(new Date()));
  const [endDate, setEndDate] = useState(() => dateInputFromDate(new Date()));
  const [reason, setReason] = useState(
    "Annual leave request for personal time off.",
  );
  const leaveMutation = useMutation(
    trpc.workforce.requestLeave.mutationOptions({
      onSuccess: async () => {
        setLeaveOpen(false);
        await queryClient.invalidateQueries(
          trpc.workforce.dashboard.queryFilter(),
        );
      },
    }),
  );

  const submitLeave = () => {
    if (leaveMutation.isPending) {
      return;
    }

    leaveMutation.mutate({
      endDate,
      reason,
      startDate,
      type: leaveType,
    });
  };

  return (
    <View style={styles.stack}>
      <ScreenTitle title="Leave & absences" />
      <View style={styles.metricGrid}>
        <MetricTile
          icon="leave"
          label="Annual left"
          onPress={() =>
            showInfo("Annual leave", [
              ["Balance", `${props.dashboard.viewer.leaveBalanceDays} days`],
              ["Employee", props.dashboard.viewer.name],
            ])
          }
          value={`${props.dashboard.viewer.leaveBalanceDays}d`}
        />
        <MetricTile
          icon="approvals"
          label="Pending"
          onPress={() =>
            showInfo("Pending leave", [["Pending requests", pendingLeave]])
          }
          tone={pendingLeave > 0 ? "warning" : undefined}
          value={String(pendingLeave)}
        />
      </View>
      <SectionCard title="Pending requests">
        {leaveRows.length ? (
          leaveRows.map((leave) => (
            <StatusRow
              key={leave.id}
              label={leave.type}
              onPress={() =>
                showInfo("Leave request", [
                  ["Employee", leave.userName],
                  ["Dates", leave.range],
                  ["Status", toTitleCase(leave.status)],
                ])
              }
              status={toTitleCase(leave.status)}
              tone={leave.status === "APPROVED" ? "success" : "warning"}
            />
          ))
        ) : (
          <EmptyState
            detail="Leave requests will appear when returned by the API."
            title="No leave requests"
          />
        )}
      </SectionCard>
      <ActionButton
        label="New request"
        onPress={() => setLeaveOpen(true)}
        variant="primary"
      />
      <FormModal
        actionLabel={leaveMutation.isPending ? "Submitting..." : "Submit leave"}
        errorMessage={leaveMutation.error?.message}
        onCancel={() => setLeaveOpen(false)}
        onSubmit={submitLeave}
        submitDisabled={
          !startDate ||
          !endDate ||
          reason.trim().length < 12 ||
          leaveMutation.isPending
        }
        title="New leave request"
        visible={leaveOpen}
      >
        <Text style={formStyles.label}>Leave type</Text>
        <View style={formStyles.optionRow}>
          {leaveTypes.map((type) => (
            <Pressable
              accessibilityRole="button"
              key={type}
              onPress={() => setLeaveType(type)}
              style={({ pressed }) => [
                formStyles.option,
                type === leaveType ? formStyles.optionActive : null,
                pressed ? formStyles.pressed : null,
              ]}
            >
              <Text
                style={[
                  formStyles.optionText,
                  type === leaveType ? formStyles.optionTextActive : null,
                ]}
              >
                {toTitleCase(type)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={formStyles.label}>Start date</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#64748b"
          style={formStyles.input}
          value={startDate}
        />
        <Text style={formStyles.label}>End date</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={setEndDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#64748b"
          style={formStyles.input}
          value={endDate}
        />
        <Text style={formStyles.label}>Reason</Text>
        <TextInput
          multiline
          onChangeText={setReason}
          style={[formStyles.input, formStyles.textArea]}
          value={reason}
        />
      </FormModal>
    </View>
  );
}

function EmployeePayScreen(props: { dashboard: DashboardData }) {
  const latest = latestTimesheet(props.dashboard);
  const gross = props.dashboard.stats.grossPay;
  const currency = props.dashboard.company.currency;
  const sharePayslip = async () => {
    if (!latest) {
      return;
    }

    await Share.share({
      message: [
        `Reference: ${latest.reference}`,
        `Clock: ${timesheetRange(latest)}`,
        `Worked hours: ${latest.workedHours}h`,
        `Gross pay: ${money(latest.grossPay, currency)}`,
      ].join("\n"),
      title: `${latest.reference} payslip`,
    });
  };

  return (
    <View style={styles.stack}>
      <ScreenTitle title="My pay" />
      <View style={styles.heroCard}>
        <IconBadge icon="pay" tone="green" />
        <Text style={styles.mutedText}>Gross pay this cycle</Text>
        <Text style={styles.payValue}>{money(gross, currency)}</Text>
      </View>
      <SectionCard title="Cycle summary">
        <KeyValue
          label="Hours this cycle"
          value={`${props.dashboard.stats.hoursThisCycle.toFixed(1)}h`}
        />
        <KeyValue
          label="Overtime hours"
          tone={props.dashboard.stats.overtimeHours > 0 ? "success" : undefined}
          value={`${props.dashboard.stats.overtimeHours.toFixed(1)}h`}
        />
        <KeyValue label="Gross pay" strong value={money(gross, currency)} />
      </SectionCard>
      <SectionCard title="Latest timesheet">
        {latest ? (
          <>
            <KeyValue label="Reference" value={latest.reference} />
            <KeyValue label="Clock" value={timesheetRange(latest)} />
            <KeyValue label="Worked hours" value={`${latest.workedHours}h`} />
            <KeyValue
              label="Gross pay"
              strong
              value={money(latest.grossPay, currency)}
            />
          </>
        ) : (
          <EmptyState
            detail="Payslip-style rows will appear when timesheets are returned."
            title="No timesheet pay data"
          />
        )}
      </SectionCard>
      <View style={styles.buttonRow}>
        <ActionButton
          disabled={!latest}
          label="View payslip"
          onPress={() =>
            showInfo("Payslip", [
              ["Reference", latest?.reference],
              [
                "Gross pay",
                latest ? money(latest.grossPay, currency) : "No timesheet is available.",
              ],
            ])
          }
          style={styles.flexButton}
          variant="primary"
        />
        <ActionButton
          disabled={!latest}
          label="Export PDF"
          onPress={() => void sharePayslip()}
          style={styles.flexButton}
        />
      </View>
    </View>
  );
}

function FormModal(props: {
  actionLabel: string;
  children: ReactNode;
  errorMessage?: string;
  onCancel: () => void;
  onSubmit: () => void;
  submitDisabled?: boolean;
  title: string;
  visible: boolean;
}) {
  return (
    <Modal animationType="fade" transparent visible={props.visible}>
      <View style={formStyles.scrim}>
        <View style={formStyles.card}>
          <Text style={formStyles.title}>{props.title}</Text>
          <View style={formStyles.body}>{props.children}</View>
          {props.errorMessage ? (
            <Text style={formStyles.errorText}>{props.errorMessage}</Text>
          ) : null}
          <View style={formStyles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              onPress={props.onCancel}
              style={({ pressed }) => [
                formStyles.secondaryButton,
                pressed ? formStyles.pressed : null,
              ]}
            >
              <Text style={formStyles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={props.submitDisabled}
              onPress={props.onSubmit}
              style={({ pressed }) => [
                formStyles.primaryButton,
                props.submitDisabled ? formStyles.disabled : null,
                pressed ? formStyles.pressed : null,
              ]}
            >
              <Text style={formStyles.primaryText}>{props.actionLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const formStyles = StyleSheet.create({
  body: {
    gap: 8,
    marginTop: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#bfdbfe",
    borderRadius: 16,
    borderWidth: 1,
    maxHeight: "88%",
    padding: 16,
    width: "92%",
  },
  disabled: {
    opacity: 0.5,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 10,
  },
  helperText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
  },
  input: {
    backgroundColor: "#f8fbff",
    borderColor: "#bfdbfe",
    borderRadius: 10,
    borderWidth: 1,
    color: "#13264b",
    fontSize: 13,
    fontWeight: "800",
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  label: {
    color: "#13264b",
    fontSize: 12,
    fontWeight: "900",
  },
  option: {
    backgroundColor: "#f8fbff",
    borderColor: "#dbeafe",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  optionActive: {
    backgroundColor: "#087cc1",
    borderColor: "#087cc1",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  optionText: {
    color: "#13264b",
    fontSize: 11,
    fontWeight: "900",
  },
  optionTextActive: {
    color: "#ffffff",
  },
  pressed: {
    opacity: 0.72,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#087cc1",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  primaryText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  scrim: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#eef6ff",
    borderColor: "#bfdbfe",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  secondaryText: {
    color: "#13264b",
    fontSize: 12,
    fontWeight: "900",
  },
  textArea: {
    minHeight: 82,
    textAlignVertical: "top",
  },
  title: {
    color: "#13264b",
    fontSize: 18,
    fontWeight: "900",
  },
});
