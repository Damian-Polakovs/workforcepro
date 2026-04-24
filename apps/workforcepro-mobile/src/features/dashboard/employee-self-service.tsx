import { Pressable, Text, TextInput, View } from "react-native";

import type { DashboardData, DashboardTimesheet, LeaveType } from "./types";
import { leaveTypes } from "./types";
import { ActionButton, QueueRow, Section } from "./components";

export function EmployeeSelfServiceSections(props: {
  correctionClockOut: string;
  correctionReason: string;
  dashboard: DashboardData;
  latestClosedTimesheet?: DashboardTimesheet;
  leaveEndDate: string;
  leaveReason: string;
  leaveStartDate: string;
  leaveType: LeaveType;
  onCorrectionClockOutChange: (value: string) => void;
  onCorrectionReasonChange: (value: string) => void;
  onLeaveEndDateChange: (value: string) => void;
  onLeaveReasonChange: (value: string) => void;
  onLeaveStartDateChange: (value: string) => void;
  onLeaveTypeChange: (type: LeaveType) => void;
  onSubmitCorrection: () => void;
  onSubmitLeave: () => void;
}) {
  return (
    <>
      <Section title="Upcoming roster">
        <View className="gap-3">
          {props.dashboard.upcomingShifts.map((shift) => (
            <QueueRow
              key={shift.id}
              detail={`${shift.range}${shift.notes ? `\n${shift.notes}` : ""}`}
              title={shift.team}
            />
          ))}
        </View>
      </Section>

      <Section title="Recent timesheets">
        <View className="gap-3">
          {props.dashboard.recentTimesheets.map((entry) => (
            <View
              key={entry.id}
              className="rounded-3xl border border-white/10 bg-[#102032] px-4 py-4"
            >
              <Text className="text-base font-semibold text-white">
                {entry.label}
              </Text>
              <Text className="mt-2 text-sm text-[#b8cad8]">
                {entry.dateLabel} | {entry.workedHours.toFixed(1)}h |{" "}
                {entry.status}
              </Text>
              <Text className="mt-1 text-sm text-[#9fb4c8]">
                Late {entry.lateMinutes}m | Early departure{" "}
                {entry.earlyDepartureMinutes}m
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Leave request">
        <View className="gap-3">
          <View className="flex-row flex-wrap gap-2">
            {leaveTypes.map((type) => (
              <Pressable
                key={type}
                className={`rounded-full px-4 py-2 ${
                  props.leaveType === type
                    ? "bg-[#4ecdc4]"
                    : "border border-white/12 bg-white/5"
                }`}
                onPress={() => props.onLeaveTypeChange(type)}
              >
                <Text className="text-xs font-semibold text-white">
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            className="rounded-2xl border border-white/12 bg-[#0f1f2f] px-4 py-3 text-white"
            onChangeText={props.onLeaveStartDateChange}
            placeholder="Start date (YYYY-MM-DD)"
            placeholderTextColor="#6f879a"
            value={props.leaveStartDate}
          />
          <TextInput
            className="rounded-2xl border border-white/12 bg-[#0f1f2f] px-4 py-3 text-white"
            onChangeText={props.onLeaveEndDateChange}
            placeholder="End date (YYYY-MM-DD)"
            placeholderTextColor="#6f879a"
            value={props.leaveEndDate}
          />
          <TextInput
            className="min-h-[92px] rounded-2xl border border-white/12 bg-[#0f1f2f] px-4 py-3 text-white"
            multiline
            onChangeText={props.onLeaveReasonChange}
            placeholder="Reason"
            placeholderTextColor="#6f879a"
            textAlignVertical="top"
            value={props.leaveReason}
          />
          <ActionButton
            label="Submit leave request"
            onPress={props.onSubmitLeave}
          />
        </View>
      </Section>

      {props.latestClosedTimesheet ? (
        <Section title="Time correction">
          <View className="gap-3">
            <Text className="text-sm leading-6 text-[#b8cad8]">
              Use the latest completed timesheet when a close-out or start time
              needs review.
            </Text>
            <TextInput
              className="rounded-2xl border border-white/12 bg-[#0f1f2f] px-4 py-3 text-white"
              onChangeText={props.onCorrectionClockOutChange}
              placeholder="Corrected clock-out (YYYY-MM-DDTHH:MM:SS)"
              placeholderTextColor="#6f879a"
              value={props.correctionClockOut}
            />
            <TextInput
              className="min-h-[92px] rounded-2xl border border-white/12 bg-[#0f1f2f] px-4 py-3 text-white"
              multiline
              onChangeText={props.onCorrectionReasonChange}
              placeholder="Correction reason"
              placeholderTextColor="#6f879a"
              textAlignVertical="top"
              value={props.correctionReason}
            />
            <ActionButton
              emphasis="ghost"
              label="Submit correction"
              onPress={props.onSubmitCorrection}
            />
          </View>
        </Section>
      ) : null}
    </>
  );
}
