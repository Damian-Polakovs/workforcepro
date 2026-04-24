import { Text, View } from "react-native";

import type { DashboardData } from "./types";
import { ActionButton } from "./components";

export function TodayPanel(props: {
  activeTimer: string;
  dashboard: DashboardData;
  isBusy: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  onCreateFaceScan: () => void;
  onEndBreak: () => void;
  onStartBreak: () => void;
}) {
  const { dashboard } = props;

  return (
    <View className="mt-5 rounded-[30px] border border-[#ff764a]/20 bg-[#ff764a]/10 p-5">
      <Text className="text-sm uppercase tracking-[3px] text-[#ffd0c3]">
        Today
      </Text>
      <Text className="mt-2 text-2xl font-semibold text-white">
        {dashboard.today.shift?.label ?? "No rostered shift"}
      </Text>
      <Text className="mt-2 text-base text-[#ffe5de]">
        Status: {dashboard.today.status.replaceAll("_", " ")}
      </Text>
      <Text className="mt-2 text-sm leading-6 text-[#ffd0c3]">
        Face scan is required before secure clock in and clock out actions.
      </Text>
      <Text className="mt-1 text-sm leading-6 text-[#ffd0c3]">
        Face profile: {dashboard.viewer.faceEnrolled ? "Ready" : "Setup required"}
      </Text>

      {dashboard.today.activeTimesheet ? (
        <View className="mt-4 rounded-3xl border border-white/15 bg-[#0d1b2a]/45 px-4 py-4">
          <Text className="text-xs uppercase tracking-[2px] text-[#ffd0c3]">
            Timer running
          </Text>
          <Text className="mt-2 text-4xl font-semibold text-white">
            {props.activeTimer}
          </Text>
          <Text className="mt-1 text-sm text-[#ffd0c3]">
            Started from verified scan at{" "}
            {new Date(
              dashboard.today.activeTimesheet.clockInAt ?? Date.now(),
            ).toLocaleTimeString("en-IE", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      ) : null}

      <View className="mt-5 flex-row flex-wrap gap-3">
        {!dashboard.viewer.faceEnrolled && (
          <ActionButton
            disabled={props.isBusy}
            label="Create first face scan"
            onPress={props.onCreateFaceScan}
          />
        )}

        {dashboard.today.status === "READY_TO_CLOCK_IN" && (
          <ActionButton
            disabled={props.isBusy || !dashboard.viewer.faceEnrolled}
            label="Clock in with face check"
            onPress={props.onClockIn}
          />
        )}

        {dashboard.today.status === "CLOCKED_IN" && (
          <>
            <ActionButton
              disabled={props.isBusy}
              emphasis="ghost"
              label="Start break"
              onPress={props.onStartBreak}
            />
            <ActionButton
              disabled={props.isBusy || !dashboard.viewer.faceEnrolled}
              emphasis="primary"
              label="Clock out"
              onPress={props.onClockOut}
            />
          </>
        )}

        {dashboard.today.status === "ON_BREAK" && (
          <ActionButton
            disabled={props.isBusy}
            emphasis="warning"
            label="End break"
            onPress={props.onEndBreak}
          />
        )}
      </View>
    </View>
  );
}
