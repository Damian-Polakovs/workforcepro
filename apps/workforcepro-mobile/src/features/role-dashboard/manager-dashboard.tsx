import { Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { DashboardData } from "~/types/api";
import { trpc } from "~/utils/api";
import {
  ActionButton,
  ApprovalCard,
  compactShiftTime,
  EmptyState,
  formatDateRange,
  formatDateTime,
  formatDay,
  initials,
  MetricTile,
  normalizedTeam,
  pendingApprovalCount,
  PersonStatusRow,
  Pill,
  ScreenTitle,
  SectionCard,
  showInfo,
  StatusRow,
  styles,
  timesheetRange,
  toTitleCase,
} from "./shared";

export function ManagerDashboard(props: {
  activeTab: string;
  dashboard: DashboardData;
}) {
  if (props.activeTab === "approvals") {
    return <ManagerApprovalsScreen dashboard={props.dashboard} />;
  }
  if (props.activeTab === "schedule") {
    return <ManagerScheduleScreen dashboard={props.dashboard} />;
  }
  if (props.activeTab === "reports") {
    return <ManagerAnalyticsScreen dashboard={props.dashboard} />;
  }
  return <ManagerTeamScreen dashboard={props.dashboard} />;
}

function ManagerTeamScreen(props: { dashboard: DashboardData }) {
  const team = normalizedTeam(props.dashboard);
  const absent = props.dashboard.queue.absences;
  const late = props.dashboard.stats.lateIncidents;
  const onSite = team.filter((member) =>
    member.status.toLowerCase().includes("clocked"),
  ).length;

  return (
    <View style={styles.stack}>
      <ScreenTitle title="Team overview" />
      <View style={styles.metricGridThree}>
        <MetricTile
          icon="team"
          label="On site"
          onPress={() =>
            showInfo("On site", [
              ["Clocked-in staff", onSite],
              ["Team records returned", team.length],
            ])
          }
          tone="success"
          value={String(onSite)}
        />
        <MetricTile
          icon="clock"
          label="Late"
          onPress={() =>
            showInfo("Late incidents", [
              ["Late incidents", late],
              [
                "Punctuality score",
                `${props.dashboard.stats.punctualityScore}%`,
              ],
            ])
          }
          tone={late > 0 ? "warning" : undefined}
          value={String(late)}
        />
        <MetricTile
          icon="absent"
          label="Absent"
          onPress={() =>
            showInfo("Absences", [
              ["Missed shifts", absent],
              ["Current pay cycle", props.dashboard.payroll?.label],
            ])
          }
          tone={absent > 0 ? "danger" : undefined}
          value={String(absent)}
        />
      </View>

      <SectionCard title="Staff status now">
        {team.length ? (
          team.slice(0, 6).map((member) => (
            <PersonStatusRow
              initials={member.initials}
              key={member.name}
              name={member.name}
              onPress={() =>
                showInfo(member.name, [
                  ["Team", member.team],
                  ["Status", member.status],
                  ["Open items", member.openItems],
                  ["Late incidents", member.lateness],
                ])
              }
              status={member.status}
            />
          ))
        ) : (
          <EmptyState
            detail="The API did not return staff for this manager scope."
            title="No staff records"
          />
        )}
      </SectionCard>

      <ActionButton
        disabled={team.length === 0}
        label="View full team"
        onPress={() =>
          showInfo(
            "Full team",
            team.map((member): [string, string] => [
              member.name,
              member.status,
            ]),
          )
        }
        variant="primary"
      />
    </View>
  );
}

function ManagerApprovalsScreen(props: { dashboard: DashboardData }) {
  const queryClient = useQueryClient();
  const pending = pendingApprovalCount(props.dashboard);
  const pendingTimesheets = props.dashboard.recentTimesheets.filter(
    (entry) => entry.status === "CLOCKED_OUT" || entry.status === "FLAGGED",
  );
  const refreshDashboard = async () => {
    await queryClient.invalidateQueries(trpc.workforce.dashboard.queryFilter());
  };
  const approveTimesheetMutation = useMutation(
    trpc.workforce.approveTimesheet.mutationOptions({
      onSuccess: refreshDashboard,
    }),
  );
  const reviewCorrectionMutation = useMutation(
    trpc.workforce.reviewCorrection.mutationOptions({
      onSuccess: refreshDashboard,
    }),
  );
  const reviewLeaveMutation = useMutation(
    trpc.workforce.reviewLeave.mutationOptions({
      onSuccess: refreshDashboard,
    }),
  );
  const visibleApprovalCount =
    props.dashboard.pendingCorrections.length +
    props.dashboard.pendingLeave.length +
    pendingTimesheets.length;

  return (
    <View style={styles.stack}>
      <View style={styles.titleRow}>
        <ScreenTitle title="Approvals" />
        <Pill
          label={`${pending} pending`}
          tone={pending > 0 ? "warning" : "info"}
        />
      </View>

      <SectionCard title="Pending approvals">
        {props.dashboard.pendingCorrections.map((correction) => (
          <View key={correction.id} style={styles.approvalActionGroup}>
            <ApprovalCard
              icon="clock"
              meta={`${correction.reference} - ${
                correction.timesheetReference ?? "No timesheet reference"
              }`}
              name={correction.userName}
              onPress={() =>
                showInfo("Time correction", [
                  ["Employee", correction.userName],
                  ["Reference", correction.reference],
                  ["Timesheet", correction.timesheetReference],
                  [
                    "Requested clock in",
                    formatDateTime(correction.requestedClockInAt),
                  ],
                  [
                    "Requested clock out",
                    formatDateTime(correction.requestedClockOutAt),
                  ],
                  ["Reason", correction.reason],
                ])
              }
              tag="Correction"
            />
            <View style={styles.buttonRow}>
              <ActionButton
                disabled={reviewCorrectionMutation.isPending}
                label="Approve"
                onPress={() =>
                  reviewCorrectionMutation.mutate({
                    correctionId: correction.id,
                    resolutionNote: "Approved from the mobile review queue.",
                    status: "APPROVED",
                  })
                }
                style={styles.flexButton}
                variant="primary"
              />
              <ActionButton
                disabled={reviewCorrectionMutation.isPending}
                label="Reject"
                onPress={() =>
                  reviewCorrectionMutation.mutate({
                    correctionId: correction.id,
                    resolutionNote: "Rejected from the mobile review queue.",
                    status: "REJECTED",
                  })
                }
                style={styles.flexButton}
              />
            </View>
          </View>
        ))}

        {props.dashboard.pendingLeave.map((leave) => (
          <View key={leave.id} style={styles.approvalActionGroup}>
            <ApprovalCard
              icon="leave"
              meta={`${formatDateRange(leave.startDate, leave.endDate)} - ${leave.hours}h`}
              name={leave.userName}
              onPress={() =>
                showInfo("Leave request", [
                  ["Employee", leave.userName],
                  ["Reference", leave.reference],
                  ["Type", toTitleCase(leave.type)],
                  ["Dates", formatDateRange(leave.startDate, leave.endDate)],
                  ["Hours", `${leave.hours}h`],
                  ["Reason", leave.reason],
                ])
              }
              tag={toTitleCase(leave.type)}
            />
            <View style={styles.buttonRow}>
              <ActionButton
                disabled={reviewLeaveMutation.isPending}
                label="Approve"
                onPress={() =>
                  reviewLeaveMutation.mutate({
                    comment: "Approved from the mobile review queue.",
                    leaveRequestId: leave.id,
                    status: "APPROVED",
                  })
                }
                style={styles.flexButton}
                variant="primary"
              />
              <ActionButton
                disabled={reviewLeaveMutation.isPending}
                label="Decline"
                onPress={() =>
                  reviewLeaveMutation.mutate({
                    comment: "Declined from the mobile review queue.",
                    leaveRequestId: leave.id,
                    status: "DECLINED",
                  })
                }
                style={styles.flexButton}
              />
            </View>
          </View>
        ))}

        {pendingTimesheets.map((timesheet) => (
          <View key={timesheet.id} style={styles.approvalActionGroup}>
            <ApprovalCard
              icon="approvals"
              meta={`${timesheet.dateLabel} - ${timesheetRange(timesheet)}`}
              name={timesheet.label}
              onPress={() =>
                showInfo("Timesheet", [
                  ["Reference", timesheet.reference],
                  ["Team", timesheet.team],
                  ["Status", toTitleCase(timesheet.status)],
                  ["Clock", timesheetRange(timesheet)],
                  ["Worked hours", `${timesheet.workedHours}h`],
                  ["Late minutes", timesheet.lateMinutes],
                  ["Overtime minutes", timesheet.overtimeMinutes],
                ])
              }
              tag={toTitleCase(timesheet.status)}
            />
            <ActionButton
              disabled={approveTimesheetMutation.isPending}
              label="Approve timesheet"
              onPress={() =>
                approveTimesheetMutation.mutate({
                  signature: props.dashboard.viewer.name,
                  timesheetId: timesheet.id,
                })
              }
              variant="primary"
            />
          </View>
        ))}

        {approveTimesheetMutation.error ? (
          <Text style={styles.textDanger}>
            {approveTimesheetMutation.error.message}
          </Text>
        ) : null}
        {reviewCorrectionMutation.error ? (
          <Text style={styles.textDanger}>
            {reviewCorrectionMutation.error.message}
          </Text>
        ) : null}
        {reviewLeaveMutation.error ? (
          <Text style={styles.textDanger}>
            {reviewLeaveMutation.error.message}
          </Text>
        ) : null}

        {visibleApprovalCount === 0 ? (
          <EmptyState
            detail={
              pending > 0
                ? "The API reported pending work, but did not return approval records for this screen."
                : "Corrections, leave requests, and clocked-out timesheets will appear here when they are returned by the API."
            }
            title={
              pending > 0 ? "Approval records missing" : "No approvals waiting"
            }
          />
        ) : null}
      </SectionCard>
    </View>
  );
}

function ManagerScheduleScreen(props: { dashboard: DashboardData }) {
  const shifts = props.dashboard.upcomingShifts;

  return (
    <View style={styles.stack}>
      <ScreenTitle title="Schedule" />
      <SectionCard title="Upcoming published shifts">
        {shifts.length ? (
          shifts.map((shift) => (
            <StatusRow
              key={shift.id}
              label={shift.label}
              onPress={() =>
                showInfo("Shift", [
                  ["Label", shift.label],
                  ["Team", shift.team],
                  ["Date", formatDay(shift.startTime)],
                  ["Time", compactShiftTime(shift)],
                  ["Status", toTitleCase(shift.status)],
                  ["Premium multiplier", `x${shift.premiumMultiplier}`],
                  ["Notes", shift.notes],
                ])
              }
              status={compactShiftTime(shift)}
              tone="info"
            />
          ))
        ) : (
          <EmptyState
            detail="Published shifts will appear here once the database returns them."
            title="No upcoming shifts"
          />
        )}
      </SectionCard>
      <ActionButton
        disabled={shifts.length === 0}
        label="Review schedule"
        onPress={() =>
          showInfo(
            "Schedule",
            shifts.map((shift): [string, string] => [
              shift.label,
              compactShiftTime(shift),
            ]),
          )
        }
        variant="primary"
      />
    </View>
  );
}

function ManagerAnalyticsScreen(props: { dashboard: DashboardData }) {
  const flagged = normalizedTeam(props.dashboard).filter(
    (member) => member.lateness > 0 || member.openItems > 0,
  );
  const recent = props.dashboard.recentTimesheets;

  return (
    <View style={styles.stack}>
      <ScreenTitle title="Attendance analytics" />
      <View style={styles.metricGridThree}>
        <MetricTile
          icon="clock"
          label="Lateness"
          onPress={() =>
            showInfo("Lateness", [
              ["Late incidents", props.dashboard.stats.lateIncidents],
              [
                "Punctuality score",
                `${props.dashboard.stats.punctualityScore}%`,
              ],
            ])
          }
          tone={props.dashboard.stats.lateIncidents > 0 ? "warning" : undefined}
          value={String(props.dashboard.stats.lateIncidents)}
        />
        <MetricTile
          icon="absent"
          label="Absences"
          onPress={() =>
            showInfo("Absences", [
              ["Missed shifts", props.dashboard.stats.absences],
            ])
          }
          tone={props.dashboard.stats.absences > 0 ? "danger" : undefined}
          value={String(props.dashboard.stats.absences)}
        />
        <MetricTile
          icon="reports"
          label="OT hours"
          onPress={() =>
            showInfo("Overtime", [
              [
                "Overtime hours",
                `${props.dashboard.stats.overtimeHours.toFixed(1)}h`,
              ],
              [
                "Hours this cycle",
                `${props.dashboard.stats.hoursThisCycle.toFixed(1)}h`,
              ],
            ])
          }
          value={`${props.dashboard.stats.overtimeHours.toFixed(1)}h`}
        />
      </View>

      <SectionCard title="Recent timesheets">
        {recent.length ? (
          recent.slice(0, 4).map((timesheet) => (
            <StatusRow
              key={timesheet.id}
              label={timesheet.label}
              onPress={() =>
                showInfo(timesheet.label, [
                  ["Reference", timesheet.reference],
                  ["Date", timesheet.dateLabel],
                  ["Clock", timesheetRange(timesheet)],
                  ["Worked hours", `${timesheet.workedHours}h`],
                  ["Status", toTitleCase(timesheet.status)],
                ])
              }
              status={toTitleCase(timesheet.status)}
              tone={timesheet.status === "FLAGGED" ? "danger" : "info"}
            />
          ))
        ) : (
          <EmptyState
            detail="Attendance rows will appear here when timesheets are returned."
            title="No timesheets returned"
          />
        )}
      </SectionCard>

      <SectionCard title="Flagged staff">
        {flagged.length ? (
          flagged.slice(0, 4).map((member) => (
            <PersonStatusRow
              initials={member.initials || initials(member.name)}
              key={member.name}
              name={member.name}
              onPress={() =>
                showInfo(member.name, [
                  ["Status", member.status],
                  ["Late incidents", member.lateness],
                  ["Open items", member.openItems],
                ])
              }
              status={
                member.openItems > 0
                  ? `${member.openItems} open`
                  : `${member.lateness} late`
              }
            />
          ))
        ) : (
          <EmptyState
            detail="Staff with late incidents or open correction items will appear here."
            title="No flagged staff"
          />
        )}
      </SectionCard>
    </View>
  );
}
