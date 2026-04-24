import { Text, View } from "react-native";

import type { DashboardData, PayrollPreviewData } from "./types";
import { ActionButton, QueueRow, Section } from "./components";

export function ManagerConsole(props: {
  dashboard: DashboardData;
  onApproveTimesheet: (timesheetId: string) => void;
  onReviewCorrection: (
    correctionId: string,
    status: "APPROVED" | "REJECTED",
  ) => void;
  onReviewLeave: (
    leaveRequestId: string,
    status: "APPROVED" | "DECLINED",
  ) => void;
  payrollData?: PayrollPreviewData;
}) {
  const { dashboard, payrollData } = props;

  if (dashboard.viewer.role === "EMPLOYEE") {
    return null;
  }

  return (
    <>
      <Section title="Manager queue">
        <View className="gap-3">
          <QueueRow
            detail={`${dashboard.queue.pendingLeave} pending leave, ${dashboard.queue.pendingCorrections} pending corrections, ${dashboard.queue.pendingTimesheets} timesheets waiting for approval.`}
            title="Approval snapshot"
          />
          {dashboard.pendingLeave.map((leave) => (
            <View
              key={leave.id}
              className="rounded-3xl border border-white/10 bg-[#102032] px-4 py-4"
            >
              <Text className="text-base font-semibold text-white">
                {leave.userName} | {leave.type}
              </Text>
              <Text className="mt-2 text-sm leading-6 text-[#b8cad8]">
                {leave.reason}
              </Text>
              <View className="mt-4 flex-row gap-3">
                <ActionButton
                  emphasis="ghost"
                  label="Decline"
                  onPress={() => props.onReviewLeave(leave.id, "DECLINED")}
                />
                <ActionButton
                  label="Approve"
                  onPress={() => props.onReviewLeave(leave.id, "APPROVED")}
                />
              </View>
            </View>
          ))}
          {dashboard.pendingCorrections.map((correction) => (
            <View
              key={correction.id}
              className="rounded-3xl border border-white/10 bg-[#102032] px-4 py-4"
            >
              <Text className="text-base font-semibold text-white">
                {correction.userName}
              </Text>
              <Text className="mt-2 text-sm leading-6 text-[#b8cad8]">
                {correction.reason}
              </Text>
              <View className="mt-4 flex-row gap-3">
                <ActionButton
                  emphasis="ghost"
                  label="Reject"
                  onPress={() =>
                    props.onReviewCorrection(correction.id, "REJECTED")
                  }
                />
                <ActionButton
                  label="Approve"
                  onPress={() =>
                    props.onReviewCorrection(correction.id, "APPROVED")
                  }
                />
              </View>
            </View>
          ))}
          {dashboard.recentTimesheets
            .filter((entry) => entry.status === "CLOCKED_OUT")
            .map((entry) => (
              <View
                key={`approval-${entry.id}`}
                className="rounded-3xl border border-white/10 bg-[#102032] px-4 py-4"
              >
                <Text className="text-base font-semibold text-white">
                  {entry.label}
                </Text>
                <Text className="mt-2 text-sm text-[#b8cad8]">
                  Ready for digital signature approval.
                </Text>
                <View className="mt-4">
                  <ActionButton
                    label="Approve timesheet"
                    onPress={() => props.onApproveTimesheet(entry.id)}
                  />
                </View>
              </View>
            ))}
        </View>
      </Section>

      {payrollData ? (
        <Section title="Payroll preview">
          <View className="gap-3">
            <QueueRow
              detail={`${payrollData.label} | ${payrollData.totals.employees} employees | EUR ${payrollData.totals.grossPay.toFixed(2)} gross`}
              title="Payroll-ready export"
            />
            {payrollData.rows.map((row) => (
              <QueueRow
                key={row.employee}
                detail={`${row.team} | ${row.regularHours.toFixed(1)}h regular | ${row.overtimeHours.toFixed(1)}h overtime`}
                title={`${row.employee} | EUR ${row.grossPay.toFixed(2)}`}
              />
            ))}
          </View>
        </Section>
      ) : null}
    </>
  );
}
