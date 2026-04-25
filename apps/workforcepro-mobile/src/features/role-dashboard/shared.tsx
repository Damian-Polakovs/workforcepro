import { useEffect, useState, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type {
  DashboardData,
  DashboardShift,
  DashboardTimesheet,
  LeaveCard,
} from "~/types/api";

export type IconName =
  | "absent"
  | "active"
  | "approvals"
  | "audit"
  | "break"
  | "calendar"
  | "clock"
  | "dashboard"
  | "employees"
  | "face"
  | "flag"
  | "home"
  | "hours"
  | "info"
  | "leave"
  | "pay"
  | "payroll"
  | "reports"
  | "rota"
  | "rules"
  | "schedule"
  | "team";

export type DashboardTab = {
  icon: IconName;
  id: string;
  label: string;
};

export type EmployeeActions = {
  breakAction: () => void;
  busy: boolean;
  clock: () => void;
};

type Tone = "danger" | "success" | "warning" | "info";
type InfoRow = [string, number | string | null | undefined];
type InfoModalPayload = {
  rows: InfoRow[];
  title: string;
};
let infoModalSink: ((payload: InfoModalPayload | null) => void) | null = null;

export const brand = {
  blue: "#087cc1",
  blueDark: "#075f97",
  green: "#79b82d",
  greenDark: "#4f861f",
  navy: "#13264b",
  sky: "#e7f4ff",
  surface: "#ffffff",
  tint: "#f4f8fc",
};

export function RoleShell(props: {
  activeTab: string;
  children: ReactNode;
  onSignOut: () => void;
  onTabChange: (tab: string) => void;
  tabs: DashboardTab[];
}) {
  const [infoModal, setInfoModal] = useState<InfoModalPayload | null>(null);

  useEffect(() => {
    infoModalSink = setInfoModal;

    return () => {
      if (infoModalSink === setInfoModal) {
        infoModalSink = null;
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroller}
      >
        <View style={styles.shellTopBar}>
          <View style={styles.phoneTop}>
            <View style={styles.phoneDot} />
            <View style={styles.phoneDot} />
          </View>
          <Pressable
            accessibilityLabel="Sign out"
            accessibilityRole="button"
            onPress={props.onSignOut}
            style={({ pressed }) => [
              styles.signOutButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
        {props.children}
      </ScrollView>

      <BottomNav
        activeTab={props.activeTab}
        onTabChange={props.onTabChange}
        tabs={props.tabs}
      />
      <InfoModal onClose={() => setInfoModal(null)} payload={infoModal} />
    </SafeAreaView>
  );
}

export function LoadingState(props: { title: string }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.centeredState}>
        <Text style={styles.centeredTitle}>{props.title}</Text>
      </View>
    </SafeAreaView>
  );
}

export function ScreenTitle(props: { subtitle?: string; title: string }) {
  return (
    <View>
      <Text style={styles.screenTitle}>{props.title}</Text>
      {props.subtitle ? (
        <Text style={styles.screenSubtitle}>{props.subtitle}</Text>
      ) : null}
    </View>
  );
}

export function SectionCard(props: { children: ReactNode; title?: string }) {
  return (
    <View style={styles.card}>
      {props.title ? <Text style={styles.cardTitle}>{props.title}</Text> : null}
      <View style={styles.cardBody}>{props.children}</View>
    </View>
  );
}

export function EmptyState(props: { detail?: string; title: string }) {
  return (
    <View style={styles.emptyState}>
      <IconBadge icon="info" tone="navy" />
      <View style={styles.emptyTextWrap}>
        <Text style={styles.emptyTitle}>{props.title}</Text>
        {props.detail ? (
          <Text style={styles.emptyDetail}>{props.detail}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function IconBadge(props: {
  active?: boolean;
  icon: IconName;
  tone?: "blue" | "green" | "navy";
}) {
  const toneStyle =
    props.active || props.tone === "blue"
      ? styles.iconBadgeBlue
      : props.tone === "green"
        ? styles.iconBadgeGreen
        : styles.iconBadgeNavy;
  const iconColor = props.active
    ? "#ffffff"
    : props.tone === "green"
      ? brand.greenDark
      : props.tone === "navy"
        ? brand.navy
        : brand.blueDark;

  return (
    <View
      style={[
        styles.iconBadge,
        toneStyle,
        props.active ? styles.iconBadgeActive : undefined,
      ]}
    >
      <Icon color={iconColor} name={props.icon} />
    </View>
  );
}

export function MetricTile(props: {
  icon?: IconName;
  label: string;
  onPress?: () => void;
  tone?: "danger" | "success" | "warning";
  value: string;
}) {
  const content = (
    <>
      <View style={styles.metricHeading}>
        {props.icon ? <IconBadge icon={props.icon} /> : null}
        <Text style={styles.metricLabel}>{props.label}</Text>
      </View>
      <Text style={[styles.metricValue, toneText(props.tone)]}>
        {props.value}
      </Text>
    </>
  );

  if (props.onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={props.onPress}
        style={({ pressed }) => [
          styles.metricTile,
          styles.clickableTile,
          pressed ? styles.pressed : null,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.metricTile}>{content}</View>;
}

export function KeyValue(props: {
  label: string;
  strong?: boolean;
  tone?: "danger" | "success" | "warning";
  value: string;
}) {
  return (
    <View style={styles.keyValueRow}>
      <Text style={[styles.keyLabel, props.strong ? styles.keyStrong : null]}>
        {props.label}
      </Text>
      <Text
        style={[
          styles.keyValue,
          props.strong ? styles.keyStrong : null,
          toneText(props.tone),
        ]}
      >
        {props.value}
      </Text>
    </View>
  );
}

export function Pill(props: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.pill, pillTone(props.tone)]}>
      <Text style={[styles.pillText, pillTextTone(props.tone)]}>
        {props.label}
      </Text>
    </View>
  );
}

export function ActionButton(props: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: "primary" | "secondary";
}) {
  const isPrimary = props.variant === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.actionButton,
        isPrimary ? styles.actionButtonPrimary : null,
        props.disabled ? styles.disabledButton : null,
        pressed ? styles.pressed : null,
        props.style,
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          isPrimary ? styles.actionButtonTextPrimary : null,
        ]}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

export function StatusRow(props: {
  label: string;
  onPress?: () => void;
  status: string;
  tone?: Tone;
}) {
  const content = (
    <>
      <Text style={styles.rowLabel}>{props.label}</Text>
      <Pill label={props.status} tone={props.tone} />
    </>
  );

  if (props.onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={props.onPress}
        style={({ pressed }) => [
          styles.shiftRow,
          pressed ? styles.pressed : null,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.shiftRow}>{content}</View>;
}

export function ApprovalCard(props: {
  icon?: IconName;
  meta: string;
  name: string;
  onPress: () => void;
  tag: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.approvalCard,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.metricHeading}>
        <IconBadge icon={props.icon ?? "approvals"} />
        <View style={styles.approvalTextWrap}>
          <View style={styles.titleRow}>
            <Text style={styles.rowLabel}>{props.name}</Text>
            <Pill label={props.tag} tone="warning" />
          </View>
          <Text style={styles.rowMeta}>{props.meta}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function PersonStatusRow(props: {
  initials: string;
  name: string;
  onPress?: () => void;
  status: string;
}) {
  const tone = props.status.toLowerCase().includes("absent")
    ? "danger"
    : props.status.toLowerCase().includes("late")
      ? "warning"
      : "success";
  const content = (
    <>
      <View style={[styles.avatar, avatarTone(tone)]}>
        <Text style={styles.avatarText}>{props.initials}</Text>
      </View>
      <Text style={styles.personName}>{props.name}</Text>
      <Pill label={props.status} tone={tone} />
    </>
  );

  if (props.onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={props.onPress}
        style={({ pressed }) => [
          styles.personRow,
          pressed ? styles.pressed : null,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.personRow}>{content}</View>;
}

export function BottomNav(props: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs: DashboardTab[];
}) {
  return (
    <View style={styles.bottomNav}>
      {props.tabs.map((tab) => {
        const active = tab.id === props.activeTab;
        return (
          <Pressable
            accessibilityRole="tab"
            key={tab.id}
            onPress={() => props.onTabChange(tab.id)}
            style={({ pressed }) => [
              styles.navItem,
              pressed ? styles.pressed : null,
            ]}
          >
            <IconBadge active={active} icon={tab.icon} />
            <Text
              style={[styles.navText, active ? styles.navTextActive : null]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function showInfo(
  title: string,
  rows: InfoRow[],
) {
  infoModalSink?.({ rows, title });
}

function InfoModal(props: {
  onClose: () => void;
  payload: InfoModalPayload | null;
}) {
  const rows = props.payload?.rows ?? [];

  return (
    <Modal
      animationType="fade"
      onRequestClose={props.onClose}
      transparent
      visible={Boolean(props.payload)}
    >
      <View style={styles.modalScrim}>
        <Pressable
          accessibilityLabel="Close details"
          onPress={props.onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.infoModal}>
          <View style={styles.modalTitleRow}>
            <Text style={styles.modalTitle}>
              {props.payload?.title ?? "Details"}
            </Text>
            <Pressable
              accessibilityLabel="Close details"
              accessibilityRole="button"
              onPress={props.onClose}
              style={({ pressed }) => [
                styles.modalCloseButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.modalCloseText}>x</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalRows}
            showsVerticalScrollIndicator={false}
          >
            {rows.length ? (
              rows.map(([label, value], index) => (
                <View key={`${label}-${index}`} style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>{label}</Text>
                  <Text style={styles.modalInfoValue}>
                    {value ?? "Not returned"}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.modalEmptyText}>
                No extra information returned for this item.
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function normalizedTeam(dashboard: DashboardData) {
  return dashboard.teamBoard.map((member) => ({
    initials: member.avatarInitials,
    lateness: member.latenessCount,
    name: member.name,
    openItems: member.openItems,
    status: member.currentStatus,
    team: member.team,
  }));
}

export function employeeLeaveRows(leaves: LeaveCard[]) {
  return leaves.map((leave) => ({
    id: leave.id,
    range: formatDateRange(leave.startDate, leave.endDate),
    status: leave.status,
    type: `${toTitleCase(leave.type)} leave`,
    userName: leave.userName,
  }));
}

export function latestTimesheet(dashboard: DashboardData) {
  return dashboard.recentTimesheets[0] ?? null;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function clockLabel(dashboard: DashboardData) {
  if (!dashboard.viewer.faceEnrolled) return "Enroll face";
  if (dashboard.today.status === "CLOCKED_IN") return "Clock out";
  if (dashboard.today.status === "ON_BREAK") return "On break";
  return "Clock in";
}

export function shiftHours(shift: DashboardShift) {
  return compactShiftTime(shift).replace("-", " - ");
}

export function compactShiftTime(shift: DashboardShift) {
  if (shift.range.includes(":")) {
    const match = shift.range.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
    if (match) return `${match[1]}-${match[2]}`;
  }
  return `${formatClock(shift.startTime)}-${formatClock(shift.endTime)}`;
}

export function timesheetRange(timesheet: DashboardTimesheet) {
  return `${formatClock(timesheet.clockInAt)} - ${formatClock(
    timesheet.clockOutAt,
  )}`;
}

export function formatClock(value: Date | string | null | undefined) {
  if (!value) return "--:--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return parsed.toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(value: Date | string | null | undefined) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
  });
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";
  return parsed.toLocaleString("en-IE", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

export function formatDateRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
) {
  const startLabel = formatDay(start);
  const endLabel = formatDay(end);
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}

export function money(value: number, currency = "EUR") {
  return `${currency} ${roundMoney(value).toLocaleString("en-IE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function pendingApprovalCount(dashboard: DashboardData) {
  return (
    dashboard.queue.pendingCorrections +
    dashboard.queue.pendingLeave +
    dashboard.queue.pendingTimesheets
  );
}

function Icon(props: { color: string; name: IconName }) {
  const color = props.color;
  const bg = { backgroundColor: color };
  const border = { borderColor: color };

  if (props.name === "employees" || props.name === "team") {
    return (
      <View style={styles.iconCanvas}>
        <View style={[styles.iconPeopleHeadMain, bg]} />
        <View style={[styles.iconPeopleBodyMain, bg]} />
        <View style={[styles.iconPeopleHeadSide, bg]} />
        <View style={[styles.iconPeopleBodySide, bg]} />
      </View>
    );
  }

  if (props.name === "active" || props.name === "approvals") {
    return (
      <View style={styles.iconCanvas}>
        <View style={[styles.iconCheckCircle, border]} />
        <View style={[styles.iconCheck, border]} />
      </View>
    );
  }

  if (props.name === "clock" || props.name === "hours") {
    return (
      <View style={styles.iconCanvas}>
        <View style={[styles.iconClockCircle, border]} />
        <View style={[styles.iconClockHandTall, bg]} />
        <View style={[styles.iconClockHandWide, bg]} />
      </View>
    );
  }

  if (props.name === "absent") {
    return (
      <View style={styles.iconCanvas}>
        <View style={[styles.iconAbsentCircle, border]} />
        <View style={[styles.iconAbsentSlash, bg]} />
      </View>
    );
  }

  if (props.name === "calendar" || props.name === "rota") {
    return (
      <View style={styles.iconCanvas}>
        <View style={[styles.iconCalendarFrame, border]} />
        <View style={[styles.iconCalendarTop, bg]} />
        <View style={[styles.iconCalendarDot, bg]} />
        <View style={[styles.iconCalendarDotSecond, bg]} />
      </View>
    );
  }

  if (props.name === "schedule") {
    return (
      <View style={styles.iconCanvas}>
        <View style={[styles.iconCalendarFrame, border]} />
        <View style={[styles.iconScheduleCellOne, bg]} />
        <View style={[styles.iconScheduleCellTwo, bg]} />
        <View style={[styles.iconScheduleCellThree, bg]} />
      </View>
    );
  }

  if (props.name === "reports" || props.name === "dashboard") {
    return (
      <View style={styles.iconCanvas}>
        <View style={[styles.iconBarShort, bg]} />
        <View style={[styles.iconBarMedium, bg]} />
        <View style={[styles.iconBarTall, bg]} />
      </View>
    );
  }

  if (props.name === "home") {
    return (
      <View style={styles.iconCanvas}>
        <View style={[styles.iconRoofLeft, bg]} />
        <View style={[styles.iconRoofRight, bg]} />
        <View style={[styles.iconHomeBody, border]} />
      </View>
    );
  }

  if (props.name === "leave") {
    return (
      <View style={styles.iconCanvas}>
        <View style={[styles.iconLeaf, border]} />
        <View style={[styles.iconLeafStem, bg]} />
      </View>
    );
  }

  if (props.name === "pay" || props.name === "payroll") {
    return (
      <View style={styles.iconCanvas}>
        <View style={[styles.iconCoinBack, border]} />
        <View style={[styles.iconCoinFront, border]} />
        <View style={[styles.iconCoinLine, bg]} />
      </View>
    );
  }

  if (props.name === "rules") {
    return (
      <View style={styles.iconCanvas}>
        <View style={[styles.iconGearCircle, border]} />
        <View style={[styles.iconGearDot, bg]} />
        <View style={[styles.iconGearTickTop, bg]} />
        <View style={[styles.iconGearTickSide, bg]} />
      </View>
    );
  }

  if (props.name === "audit") {
    return (
      <View style={styles.iconCanvas}>
        <View style={[styles.iconFileFrame, border]} />
        <View style={[styles.iconFileLineOne, bg]} />
        <View style={[styles.iconFileLineTwo, bg]} />
      </View>
    );
  }

  if (props.name === "flag") {
    return (
      <View style={styles.iconCanvas}>
        <View style={[styles.iconFlagPole, bg]} />
        <View style={[styles.iconFlagPanel, bg]} />
      </View>
    );
  }

  if (props.name === "face") {
    return (
      <View style={styles.iconCanvas}>
        <View style={[styles.iconFaceScanCornerOne, border]} />
        <View style={[styles.iconFaceScanCornerTwo, border]} />
        <View style={[styles.iconFaceHead, bg]} />
        <View style={[styles.iconFaceBody, bg]} />
      </View>
    );
  }

  if (props.name === "break") {
    return (
      <View style={styles.iconCanvas}>
        <View style={[styles.iconPauseOne, bg]} />
        <View style={[styles.iconPauseTwo, bg]} />
      </View>
    );
  }

  return (
    <View style={styles.iconCanvas}>
      <View style={[styles.iconInfoCircle, border]} />
      <View style={[styles.iconInfoDot, bg]} />
      <View style={[styles.iconInfoStem, bg]} />
    </View>
  );
}

function toneText(tone?: "danger" | "success" | "warning") {
  if (tone === "danger") return styles.textDanger;
  if (tone === "success") return styles.textSuccess;
  if (tone === "warning") return styles.textWarning;
  return undefined;
}

function pillTone(tone?: Tone) {
  if (tone === "danger") return styles.pillDanger;
  if (tone === "success") return styles.pillSuccess;
  if (tone === "warning") return styles.pillWarning;
  if (tone === "info") return styles.pillInfo;
  return undefined;
}

function pillTextTone(tone?: Tone) {
  if (tone === "danger") return styles.pillTextDanger;
  if (tone === "success") return styles.pillTextSuccess;
  if (tone === "warning") return styles.pillTextWarning;
  if (tone === "info") return styles.pillTextInfo;
  return undefined;
}

function avatarTone(tone: "danger" | "success" | "warning") {
  if (tone === "danger") return styles.avatarDanger;
  if (tone === "warning") return styles.avatarWarning;
  return styles.avatarInfo;
}

export const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    backgroundColor: brand.surface,
    borderColor: "#bfdbfe",
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 14,
  },
  actionButtonPrimary: {
    backgroundColor: brand.blue,
    borderColor: brand.blue,
  },
  actionButtonText: {
    color: brand.navy,
    fontSize: 12,
    fontWeight: "800",
  },
  actionButtonTextPrimary: {
    color: "#ffffff",
  },
  approvalCard: {
    backgroundColor: brand.surface,
    borderColor: "#dbeafe",
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    minHeight: 74,
    padding: 12,
  },
  approvalTextWrap: {
    flex: 1,
    gap: 5,
  },
  approvalActionGroup: {
    gap: 8,
  },
  auditItem: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
  },
  auditTextWrap: {
    flex: 1,
    gap: 3,
  },
  avatar: {
    alignItems: "center",
    borderRadius: 18,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  avatarDanger: {
    backgroundColor: "#fee2e2",
  },
  avatarInfo: {
    backgroundColor: brand.sky,
  },
  avatarText: {
    color: brand.navy,
    fontSize: 10,
    fontWeight: "900",
  },
  avatarWarning: {
    backgroundColor: "#fef3c7",
  },
  bigValue: {
    color: brand.navy,
    fontSize: 22,
    fontWeight: "900",
  },
  bottomNav: {
    backgroundColor: brand.surface,
    borderColor: "#dbeafe",
    borderTopWidth: 1,
    flexDirection: "row",
    minHeight: 72,
    paddingHorizontal: 10,
    paddingTop: 9,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  card: {
    backgroundColor: brand.surface,
    borderColor: "#dbeafe",
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    minHeight: 82,
    padding: 12,
  },
  cardBody: {
    gap: 11,
  },
  cardTitle: {
    color: brand.blueDark,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  centeredState: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  centeredTitle: {
    color: brand.navy,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  chip: {
    backgroundColor: "#eef6ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: brand.green,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  chipText: {
    color: brand.navy,
    fontSize: 11,
    fontWeight: "800",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  clickableTile: {
    borderColor: brand.blue,
  },
  content: {
    flexGrow: 1,
    gap: 12,
    paddingBottom: 14,
    paddingHorizontal: 8,
  },
  disabledButton: {
    opacity: 0.45,
  },
  divider: {
    backgroundColor: "#dbeafe",
    height: 1,
  },
  emptyDetail: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 17,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: "#f8fbff",
    borderColor: "#dbeafe",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  emptyTextWrap: {
    flex: 1,
    gap: 3,
  },
  emptyTitle: {
    color: brand.navy,
    fontSize: 13,
    fontWeight: "900",
  },
  errorState: {
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 18,
  },
  flexButton: {
    flex: 1,
  },
  helperText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  heroCard: {
    alignItems: "center",
    backgroundColor: brand.navy,
    borderRadius: 16,
    gap: 8,
    minHeight: 122,
    padding: 22,
  },
  iconAbsentCircle: {
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    left: 2,
    position: "absolute",
    top: 2,
    width: 14,
  },
  iconAbsentSlash: {
    borderRadius: 2,
    height: 2,
    left: 3,
    position: "absolute",
    top: 8,
    transform: [{ rotate: "-38deg" }],
    width: 13,
  },
  iconBadge: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  iconBadgeActive: {
    transform: [{ scale: 1.06 }],
  },
  iconBadgeBlue: {
    backgroundColor: brand.blue,
  },
  iconBadgeGreen: {
    backgroundColor: "#edf8e5",
  },
  iconBadgeNavy: {
    backgroundColor: "#e8edf7",
  },
  iconBarMedium: {
    borderRadius: 2,
    bottom: 2,
    height: 10,
    left: 7,
    position: "absolute",
    width: 4,
  },
  iconBarShort: {
    borderRadius: 2,
    bottom: 2,
    height: 7,
    left: 2,
    position: "absolute",
    width: 4,
  },
  iconBarTall: {
    borderRadius: 2,
    bottom: 2,
    height: 14,
    left: 12,
    position: "absolute",
    width: 4,
  },
  iconCalendarDot: {
    borderRadius: 2,
    height: 4,
    left: 5,
    position: "absolute",
    top: 9,
    width: 4,
  },
  iconCalendarDotSecond: {
    borderRadius: 2,
    height: 4,
    left: 11,
    position: "absolute",
    top: 9,
    width: 4,
  },
  iconCalendarFrame: {
    borderRadius: 3,
    borderWidth: 2,
    height: 15,
    left: 2,
    position: "absolute",
    top: 2,
    width: 14,
  },
  iconCalendarTop: {
    borderRadius: 1,
    height: 3,
    left: 3,
    position: "absolute",
    top: 5,
    width: 12,
  },
  iconCanvas: {
    height: 18,
    position: "relative",
    width: 18,
  },
  iconCheck: {
    borderBottomWidth: 2,
    borderRightWidth: 2,
    height: 9,
    left: 7,
    position: "absolute",
    top: 3,
    transform: [{ rotate: "45deg" }],
    width: 5,
  },
  iconCheckCircle: {
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    left: 1,
    position: "absolute",
    top: 1,
    width: 16,
  },
  iconClockCircle: {
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    left: 1,
    position: "absolute",
    top: 1,
    width: 16,
  },
  iconClockHandTall: {
    borderRadius: 1,
    height: 6,
    left: 8,
    position: "absolute",
    top: 4,
    width: 2,
  },
  iconClockHandWide: {
    borderRadius: 1,
    height: 2,
    left: 8,
    position: "absolute",
    top: 9,
    width: 5,
  },
  iconCoinBack: {
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    left: 1,
    position: "absolute",
    top: 2,
    width: 14,
  },
  iconCoinFront: {
    borderRadius: 6,
    borderWidth: 2,
    height: 12,
    left: 5,
    position: "absolute",
    top: 4,
    width: 12,
  },
  iconCoinLine: {
    borderRadius: 1,
    height: 2,
    left: 8,
    position: "absolute",
    top: 9,
    width: 6,
  },
  iconFaceBody: {
    borderRadius: 5,
    height: 5,
    left: 6,
    position: "absolute",
    top: 11,
    width: 7,
  },
  iconFaceHead: {
    borderRadius: 4,
    height: 7,
    left: 6,
    position: "absolute",
    top: 4,
    width: 7,
  },
  iconFaceScanCornerOne: {
    borderLeftWidth: 2,
    borderTopWidth: 2,
    height: 6,
    left: 1,
    position: "absolute",
    top: 1,
    width: 6,
  },
  iconFaceScanCornerTwo: {
    borderBottomWidth: 2,
    borderRightWidth: 2,
    height: 6,
    left: 11,
    position: "absolute",
    top: 11,
    width: 6,
  },
  iconFileFrame: {
    borderRadius: 3,
    borderWidth: 2,
    height: 16,
    left: 3,
    position: "absolute",
    top: 1,
    width: 12,
  },
  iconFileLineOne: {
    borderRadius: 1,
    height: 2,
    left: 6,
    position: "absolute",
    top: 7,
    width: 6,
  },
  iconFileLineTwo: {
    borderRadius: 1,
    height: 2,
    left: 6,
    position: "absolute",
    top: 11,
    width: 6,
  },
  iconFlagPanel: {
    borderBottomRightRadius: 3,
    borderTopRightRadius: 3,
    height: 8,
    left: 6,
    position: "absolute",
    top: 3,
    width: 9,
  },
  iconFlagPole: {
    borderRadius: 1,
    height: 15,
    left: 4,
    position: "absolute",
    top: 2,
    width: 2,
  },
  iconGearCircle: {
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    left: 2,
    position: "absolute",
    top: 2,
    width: 14,
  },
  iconGearDot: {
    borderRadius: 2,
    height: 4,
    left: 7,
    position: "absolute",
    top: 7,
    width: 4,
  },
  iconGearTickSide: {
    borderRadius: 1,
    height: 2,
    left: 0,
    position: "absolute",
    top: 8,
    width: 4,
  },
  iconGearTickTop: {
    borderRadius: 1,
    height: 4,
    left: 8,
    position: "absolute",
    top: 0,
    width: 2,
  },
  iconHomeBody: {
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    height: 8,
    left: 4,
    position: "absolute",
    top: 8,
    width: 10,
  },
  iconInfoCircle: {
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    left: 1,
    position: "absolute",
    top: 1,
    width: 16,
  },
  iconInfoDot: {
    borderRadius: 1,
    height: 2,
    left: 8,
    position: "absolute",
    top: 5,
    width: 2,
  },
  iconInfoStem: {
    borderRadius: 1,
    height: 6,
    left: 8,
    position: "absolute",
    top: 8,
    width: 2,
  },
  iconLeaf: {
    borderBottomLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 2,
    height: 13,
    left: 4,
    position: "absolute",
    top: 2,
    transform: [{ rotate: "-28deg" }],
    width: 10,
  },
  iconLeafStem: {
    borderRadius: 1,
    height: 11,
    left: 8,
    position: "absolute",
    top: 6,
    transform: [{ rotate: "35deg" }],
    width: 2,
  },
  iconPauseOne: {
    borderRadius: 2,
    height: 14,
    left: 4,
    position: "absolute",
    top: 2,
    width: 4,
  },
  iconPauseTwo: {
    borderRadius: 2,
    height: 14,
    left: 11,
    position: "absolute",
    top: 2,
    width: 4,
  },
  iconPeopleBodyMain: {
    borderRadius: 5,
    height: 8,
    left: 5,
    position: "absolute",
    top: 10,
    width: 8,
  },
  iconPeopleBodySide: {
    borderRadius: 4,
    height: 6,
    left: 1,
    position: "absolute",
    top: 11,
    width: 6,
  },
  iconPeopleHeadMain: {
    borderRadius: 4,
    height: 8,
    left: 5,
    position: "absolute",
    top: 2,
    width: 8,
  },
  iconPeopleHeadSide: {
    borderRadius: 3,
    height: 6,
    left: 1,
    position: "absolute",
    top: 5,
    width: 6,
  },
  iconRoofLeft: {
    borderRadius: 1,
    height: 3,
    left: 3,
    position: "absolute",
    top: 6,
    transform: [{ rotate: "-38deg" }],
    width: 8,
  },
  iconRoofRight: {
    borderRadius: 1,
    height: 3,
    left: 8,
    position: "absolute",
    top: 6,
    transform: [{ rotate: "38deg" }],
    width: 8,
  },
  iconScheduleCellOne: {
    borderRadius: 2,
    height: 4,
    left: 5,
    position: "absolute",
    top: 7,
    width: 4,
  },
  iconScheduleCellThree: {
    borderRadius: 2,
    height: 4,
    left: 5,
    position: "absolute",
    top: 12,
    width: 4,
  },
  iconScheduleCellTwo: {
    borderRadius: 2,
    height: 4,
    left: 10,
    position: "absolute",
    top: 7,
    width: 4,
  },
  keyLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
  },
  keyStrong: {
    color: brand.navy,
    fontSize: 13,
    fontWeight: "900",
  },
  keyValue: {
    color: brand.navy,
    fontSize: 12,
    fontWeight: "900",
  },
  keyValueRow: {
    alignItems: "center",
    borderBottomColor: "#e2e8f0",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 31,
    paddingBottom: 6,
  },
  metricGrid: {
    flexDirection: "row",
    gap: 8,
  },
  metricGridThree: {
    flexDirection: "row",
    gap: 7,
  },
  metricHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  metricLabel: {
    color: "#475569",
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
  },
  metricTile: {
    backgroundColor: "#f8fbff",
    borderColor: "#dbeafe",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minHeight: 82,
    padding: 10,
  },
  metricValue: {
    color: brand.navy,
    fontSize: 19,
    fontWeight: "900",
  },
  infoModal: {
    backgroundColor: brand.surface,
    borderColor: "#bfdbfe",
    borderRadius: 14,
    borderWidth: 1,
    maxHeight: "78%",
    padding: 14,
    width: "92%",
  },
  modalCloseButton: {
    alignItems: "center",
    backgroundColor: "#eef6ff",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  modalCloseText: {
    color: brand.navy,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 16,
  },
  modalEmptyText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "center",
  },
  modalInfoLabel: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  modalInfoRow: {
    backgroundColor: "#f8fbff",
    borderColor: "#dbeafe",
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalInfoValue: {
    color: brand.navy,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  modalRows: {
    gap: 8,
    paddingTop: 12,
  },
  modalScrim: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.48)",
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  modalTitle: {
    color: brand.navy,
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
  },
  modalTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  mutedText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
  },
  navItem: {
    alignItems: "center",
    flex: 1,
    gap: 5,
    justifyContent: "flex-start",
  },
  navText: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
  },
  navTextActive: {
    color: brand.blue,
  },
  payValue: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
  },
  personName: {
    color: brand.navy,
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
  },
  personRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    minHeight: 38,
  },
  phoneDot: {
    backgroundColor: "#94a3b8",
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  phoneTop: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "flex-start",
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: "#eef6ff",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pillDanger: {
    backgroundColor: "#fee2e2",
  },
  pillInfo: {
    backgroundColor: brand.sky,
  },
  pillSuccess: {
    backgroundColor: "#edf8e5",
  },
  pillText: {
    color: brand.navy,
    fontSize: 10,
    fontWeight: "900",
  },
  pillTextDanger: {
    color: "#b91c1c",
  },
  pillTextInfo: {
    color: brand.blueDark,
  },
  pillTextSuccess: {
    color: brand.greenDark,
  },
  pillTextWarning: {
    color: "#92400e",
  },
  pillWarning: {
    backgroundColor: "#fef3c7",
  },
  pressed: {
    opacity: 0.68,
  },
  progressFill: {
    backgroundColor: brand.blue,
    borderRadius: 3,
    height: 6,
  },
  progressTrack: {
    backgroundColor: "#dbeafe",
    borderRadius: 3,
    height: 6,
    overflow: "hidden",
  },
  rowLabel: {
    color: brand.navy,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "900",
  },
  rowMeta: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
  },
  scanAvatar: {
    alignItems: "center",
    backgroundColor: brand.surface,
    borderRadius: 34,
    height: 68,
    justifyContent: "center",
    width: 68,
  },
  scanCard: {
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
    minHeight: 128,
  },
  scanInitials: {
    color: brand.navy,
    fontSize: 16,
    fontWeight: "900",
  },
  scanRing: {
    alignItems: "center",
    borderColor: brand.blue,
    borderRadius: 50,
    borderStyle: "dashed",
    borderWidth: 2,
    height: 96,
    justifyContent: "center",
    width: 96,
  },
  scanText: {
    color: brand.blue,
    fontSize: 11,
    fontWeight: "800",
  },
  screen: {
    backgroundColor: brand.tint,
    flex: 1,
  },
  scroller: {
    flex: 1,
  },
  screenSubtitle: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "center",
  },
  screenTitle: {
    color: brand.navy,
    fontSize: 17,
    fontWeight: "900",
  },
  selectBox: {
    alignItems: "center",
    backgroundColor: "#f8fbff",
    borderColor: "#bfdbfe",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  selectCaret: {
    color: brand.blue,
    fontSize: 14,
    fontWeight: "900",
  },
  selectOption: {
    backgroundColor: "#f8fbff",
    borderColor: "#dbeafe",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectOptionActive: {
    borderColor: brand.green,
  },
  selectText: {
    color: brand.navy,
    fontSize: 13,
    fontWeight: "900",
  },
  shiftRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    minHeight: 36,
  },
  shellTopBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  signOutButton: {
    backgroundColor: "#eef6ff",
    borderColor: "#bfdbfe",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  signOutText: {
    color: brand.blueDark,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  stack: {
    flexGrow: 1,
    gap: 12,
    justifyContent: "space-between",
  },
  textDanger: {
    color: "#dc2626",
  },
  textSuccess: {
    color: brand.greenDark,
  },
  textWarning: {
    color: "#d97706",
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
});
