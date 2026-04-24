import { Pressable, Text, View } from "react-native";

import type { DashboardData, DemoProfile } from "./types";
import { MiniMetric } from "./components";

export function DashboardHeader(props: {
  dashboard: DashboardData;
  onSelectProfile: (email: string) => void;
  onSignOut: () => void;
  profiles: readonly DemoProfile[];
  selectedProfile: DemoProfile;
  viewerEmail: string;
}) {
  return (
    <View className="mt-2 rounded-[34px] border border-white/10 bg-[#10253a] px-5 py-6">
      <Text className="text-xs uppercase tracking-[3px] text-[#9fb4c8]">
        WorkForcePro mobile console
      </Text>
      <Text className="mt-3 text-4xl font-semibold leading-[46px] text-white">
        {props.dashboard.viewer.name}
      </Text>
      <Text className="mt-2 text-base leading-7 text-[#bed0dd]">
        {props.selectedProfile.headline}
      </Text>

      <View className="mt-5 flex-row flex-wrap gap-2">
        {props.profiles.map((profile) => (
          <Pressable
            key={profile.email}
            className={`rounded-full px-4 py-2 ${
              props.viewerEmail === profile.email
                ? "bg-[#ff764a]"
                : "border border-white/15 bg-white/5"
            }`}
            onPress={() => props.onSelectProfile(profile.email)}
          >
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-white">
              {profile.role}
            </Text>
          </Pressable>
        ))}
        <Pressable
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2"
          onPress={props.onSignOut}
        >
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-white">
            Sign out
          </Text>
        </Pressable>
      </View>

      <View className="mt-6 flex-row flex-wrap gap-3">
        <MiniMetric
          label="This cycle"
          value={`${props.dashboard.stats.hoursThisCycle.toFixed(1)}h`}
        />
        <MiniMetric
          label="Overtime"
          value={`${props.dashboard.stats.overtimeHours.toFixed(1)}h`}
        />
        <MiniMetric
          label="Punctuality"
          value={`${props.dashboard.stats.punctualityScore}%`}
        />
        <MiniMetric
          label="Gross pay"
          value={`EUR ${props.dashboard.stats.grossPay.toFixed(2)}`}
        />
      </View>
    </View>
  );
}
