import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCameraPermissions } from "expo-camera";

import type {
  DashboardTab,
  EmployeeActions,
} from "~/features/role-dashboard/shared";
import type { DemoRole } from "~/types/api";
import { AdminDashboard } from "~/features/role-dashboard/admin-dashboard";
import { EmployeeDashboard } from "~/features/role-dashboard/employee-dashboard";
import { ManagerDashboard } from "~/features/role-dashboard/manager-dashboard";
import {
  ActionButton,
  LoadingState,
  RoleShell,
  styles,
} from "~/features/role-dashboard/shared";
import { trpc } from "~/utils/api";
import { getBaseUrl } from "~/utils/base-url";

type FaceScanMode = "clockIn" | "clockOut" | "enroll";
type DashboardNotice = {
  message: string;
  title: string;
};

const roleTabs: Record<DemoRole, DashboardTab[]> = {
  ADMIN: [
    { icon: "dashboard", id: "dashboard", label: "Dash" },
    { icon: "payroll", id: "payroll", label: "Payroll" },
    { icon: "rules", id: "rules", label: "Rules" },
    { icon: "audit", id: "audit", label: "Audit" },
  ],
  MANAGER: [
    { icon: "team", id: "team", label: "Team" },
    { icon: "approvals", id: "approvals", label: "Approvals" },
    { icon: "schedule", id: "schedule", label: "Schedule" },
    { icon: "reports", id: "reports", label: "Reports" },
  ],
  EMPLOYEE: [
    { icon: "home", id: "home", label: "Home" },
    { icon: "rota", id: "rota", label: "Rota" },
    { icon: "leave", id: "leave", label: "Leave" },
    { icon: "pay", id: "pay", label: "Pay" },
  ],
};

export default function DashboardScreen() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <LoadingState title="Securing WorkForcePro..." />;
  }

  if (!isSignedIn) {
    return <Redirect href={"/sign-in" as never} />;
  }

  return <DashboardContent />;
}

function DashboardContent() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [requestingCameraAccess, setRequestingCameraAccess] = useState(false);
  const [pendingFaceScanMode, setPendingFaceScanMode] =
    useState<FaceScanMode | null>(null);
  const [notice, setNotice] = useState<DashboardNotice | null>(null);
  const apiBaseUrl = useMemo(() => {
    try {
      return getBaseUrl();
    } catch {
      return "the configured API URL";
    }
  }, []);

  const dashboardQuery = useQuery({
    ...trpc.workforce.dashboard.queryOptions({ focus: "OPS" }),
    retry: 1,
  });

  const refreshDashboard = async () => {
    await queryClient.invalidateQueries(trpc.workforce.dashboard.queryFilter());
  };

  const startBreakMutation = useMutation(
    trpc.workforce.startBreak.mutationOptions({
      onSuccess: refreshDashboard,
    }),
  );

  const endBreakMutation = useMutation(
    trpc.workforce.endBreak.mutationOptions({
      onSuccess: refreshDashboard,
    }),
  );

  const role = dashboardQuery.data?.viewer.role;

  useEffect(() => {
    setActiveTab(null);
  }, [role]);

  if (dashboardQuery.isLoading) {
    return <LoadingState title="Loading role workspace..." />;
  }

  if (dashboardQuery.isError) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.errorState}>
          <ActionButton
            label={`Retry API at ${apiBaseUrl}`}
            onPress={() => void dashboardQuery.refetch()}
            variant="primary"
          />
        </View>
      </SafeAreaView>
    );
  }

  const dashboard = dashboardQuery.data;

  if (!dashboard) {
    return <LoadingState title="No dashboard data available." />;
  }

  const tabs = roleTabs[dashboard.viewer.role];
  const selectedTab =
    tabs.find((tab) => tab.id === activeTab)?.id ?? tabs[0].id;

  const ensureCameraAccess = async () => {
    if (cameraPermission?.granted) {
      return true;
    }

    setRequestingCameraAccess(true);
    try {
      const result = await requestCameraPermission();
      if (result.granted) {
        return true;
      }

      setNotice({
        message:
          "Allow camera access before WorkForcePro can verify your face for clocking.",
        title: "Camera access required",
      });
      return false;
    } finally {
      setRequestingCameraAccess(false);
    }
  };

  const openFaceScan = async (mode: FaceScanMode) => {
    if (!(await ensureCameraAccess())) {
      return;
    }

    setPendingFaceScanMode(null);
    router.push({
      params: { mode },
      pathname: "/face-scan",
    });
  };

  const requestFaceScanConsent = (mode: FaceScanMode) => {
    setPendingFaceScanMode(mode);
  };

  const employeeActions: EmployeeActions = {
    breakAction: () => {
      if (dashboard.today.status === "CLOCKED_IN") {
        startBreakMutation.mutate({
          note: "Meal break started from mobile dashboard.",
        });
        return;
      }

      if (dashboard.today.status === "ON_BREAK") {
        endBreakMutation.mutate({});
        return;
      }

      setNotice({
        message: "Clock in before starting a break.",
        title: "No active break",
      });
    },
    busy:
      startBreakMutation.isPending ||
      endBreakMutation.isPending ||
      requestingCameraAccess ||
      Boolean(pendingFaceScanMode),
    clock: () => {
      if (!dashboard.viewer.faceEnrolled) {
        requestFaceScanConsent("enroll");
        return;
      }

      if (dashboard.today.status === "READY_TO_CLOCK_IN") {
        requestFaceScanConsent("clockIn");
        return;
      }

      if (dashboard.today.status === "CLOCKED_IN") {
        requestFaceScanConsent("clockOut");
        return;
      }

      if (dashboard.today.status === "ON_BREAK") {
        setNotice({
          message: "End your break before clocking out.",
          title: "Break in progress",
        });
        return;
      }

      setNotice({
        message: "There is no active shift to clock from right now.",
        title: "No shift action available",
      });
    },
  };

  return (
    <>
      <RoleShell
        activeTab={selectedTab}
        onSignOut={() => void signOut()}
        onTabChange={setActiveTab}
        tabs={tabs}
      >
        {dashboard.viewer.role === "ADMIN" ? (
          <AdminDashboard
            activeTab={selectedTab}
            dashboard={dashboard}
            setActiveTab={setActiveTab}
          />
        ) : null}

        {dashboard.viewer.role === "MANAGER" ? (
          <ManagerDashboard activeTab={selectedTab} dashboard={dashboard} />
        ) : null}

        {dashboard.viewer.role === "EMPLOYEE" ? (
          <EmployeeDashboard
            actions={employeeActions}
            activeTab={selectedTab}
            dashboard={dashboard}
          />
        ) : null}
      </RoleShell>

      <CameraConsentModal
        busy={requestingCameraAccess}
        mode={pendingFaceScanMode}
        onCancel={() => setPendingFaceScanMode(null)}
        onContinue={(mode) => void openFaceScan(mode)}
      />
      <DashboardNoticeModal
        notice={notice}
        onClose={() => setNotice(null)}
      />
    </>
  );
}

function CameraConsentModal(props: {
  busy: boolean;
  mode: FaceScanMode | null;
  onCancel: () => void;
  onContinue: (mode: FaceScanMode) => void;
}) {
  const copy =
    props.mode === "enroll"
      ? "WorkForcePro will use your camera to capture and store an encrypted face enrollment reference for secure clocking."
      : "WorkForcePro will use your camera once to verify this clock action against your enrolled face profile.";

  return (
    <Modal animationType="fade" transparent visible={Boolean(props.mode)}>
      <View style={consentStyles.scrim}>
        <View style={consentStyles.card}>
          <Text style={consentStyles.eyebrow}>Camera consent</Text>
          <Text style={consentStyles.title}>Allow secure face scan?</Text>
          <Text style={consentStyles.copy}>{copy}</Text>
          <Text style={consentStyles.copy}>
            Continue only if you consent to camera access and biometric face
            verification for this action.
          </Text>
          <View style={consentStyles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              disabled={props.busy}
              onPress={props.onCancel}
              style={({ pressed }) => [
                consentStyles.secondaryButton,
                pressed ? consentStyles.pressed : null,
              ]}
            >
              <Text style={consentStyles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={props.busy || !props.mode}
              onPress={() => props.mode && props.onContinue(props.mode)}
              style={({ pressed }) => [
                consentStyles.primaryButton,
                props.busy ? consentStyles.disabled : null,
                pressed ? consentStyles.pressed : null,
              ]}
            >
              <Text style={consentStyles.primaryText}>
                {props.busy ? "Opening camera..." : "I consent"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DashboardNoticeModal(props: {
  notice: DashboardNotice | null;
  onClose: () => void;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={props.onClose}
      transparent
      visible={Boolean(props.notice)}
    >
      <View style={consentStyles.scrim}>
        <View style={consentStyles.card}>
          <Text style={consentStyles.eyebrow}>WorkForcePro</Text>
          <Text style={consentStyles.title}>{props.notice?.title}</Text>
          <Text style={consentStyles.copy}>{props.notice?.message}</Text>
          <Pressable
            onPress={props.onClose}
            style={[consentStyles.primaryButton, consentStyles.fullButton]}
          >
            <Text style={consentStyles.primaryText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const consentStyles = StyleSheet.create({
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#bfdbfe",
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    width: "92%",
  },
  copy: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 10,
  },
  disabled: {
    opacity: 0.55,
  },
  eyebrow: {
    color: "#087cc1",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  fullButton: {
    flex: 0,
    marginTop: 18,
  },
  pressed: {
    opacity: 0.7,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#087cc1",
    borderRadius: 12,
    flex: 1,
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primaryText: {
    color: "#ffffff",
    fontSize: 13,
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
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryText: {
    color: "#13264b",
    fontSize: 13,
    fontWeight: "900",
  },
  title: {
    color: "#13264b",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 8,
  },
});
