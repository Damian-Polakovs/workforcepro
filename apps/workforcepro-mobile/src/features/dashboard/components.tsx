import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

export function ActionButton(props: {
  disabled?: boolean;
  emphasis?: "primary" | "ghost" | "warning";
  label: string;
  onPress: () => void;
}) {
  const tone =
    props.emphasis === "warning"
      ? "bg-[#d97706]"
      : props.emphasis === "ghost"
        ? "border border-white/20 bg-white/8"
        : "bg-[#ff764a]";

  return (
    <Pressable
      className={`${tone} rounded-2xl px-4 py-3 ${props.disabled ? "opacity-50" : ""}`}
      disabled={props.disabled}
      onPress={props.onPress}
    >
      <Text className="text-center text-sm font-semibold text-white">
        {props.label}
      </Text>
    </Pressable>
  );
}

export function Section(props: { children: ReactNode; title: string }) {
  return (
    <View className="rounded-[28px] border border-white/12 bg-white/7 p-5">
      <Text className="mb-4 text-lg font-semibold text-white">
        {props.title}
      </Text>
      {props.children}
    </View>
  );
}

export function MiniMetric(props: { label: string; value: string }) {
  return (
    <View className="min-w-[46%] rounded-3xl border border-white/10 bg-[#12263a] px-4 py-4">
      <Text className="text-xs uppercase tracking-[2px] text-[#9fb4c8]">
        {props.label}
      </Text>
      <Text className="mt-2 text-2xl font-semibold text-white">
        {props.value}
      </Text>
    </View>
  );
}

export function QueueRow(props: { detail: string; title: string }) {
  return (
    <View className="rounded-3xl border border-white/10 bg-[#102032] px-4 py-4">
      <Text className="text-sm font-semibold text-white">{props.title}</Text>
      <Text className="mt-1 text-sm leading-6 text-[#b8cad8]">
        {props.detail}
      </Text>
    </View>
  );
}
