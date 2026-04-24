import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Redirect, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AuditTrailSection } from "~/features/dashboard/audit-trail-section";
import { QueueRow } from "~/features/dashboard/components";
import { DashboardHeader } from "~/features/dashboard/dashboard-header";
import { EmployeeSelfServiceSections } from "~/features/dashboard/employee-self-service";
import {
  formatElapsedTime,
  isoFromClockField,
} from "~/features/dashboard/formatting";
import { ManagerConsole } from "~/features/dashboard/manager-console";
import { TodayPanel } from "~/features/dashboard/today-panel";
import type {
  DashboardAlert,
  DashboardTimesheet,
  LeaveType,
} from "~/features/dashboard/types";
import { useDemoSession } from "~/utils/auth";
import { trpc } from "~/utils/api";
import { getBaseUrl } from "~/utils/base-url";

export default function DashboardScreen() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <SafeAreaView className="flex-1 bg-[#0d1b2a]">
        <View className="flex-1 items-center justify-center gap-4">
          <ActivityIndicator color="#ff764a" size="large" />
          <Text className="text-base text-white/80">
            Securing WorkForcePro with Clerk...
          </Text>
        </View>
      </SafeAreaView>
    );
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
  const { profiles, ready, setViewerEmail, viewerEmail } = useDemoSession();
  const apiBaseUrl = useMemo(() => {
    try {
      return getBaseUrl();
    } catch {
      return "the configured API URL";
    }
  }, []);
  const [now, setNow] = useState(() => Date.now());
  const [leaveStartDate, setLeaveStartDate] = useState("2026-04-24");
  const [leaveEndDate, setLeaveEndDate] = useState("2026-04-25");
  const [leaveReason, setLeaveReason] = useState(
    "Annual leave request for personal travel.",
  );
  const [leaveType, setLeaveType] = useState<LeaveType>("ANNUAL");
  const [correctionReason, setCorrectionReason] = useState(
    "Missed clock-out after handover and lock-up checks.",
  );
  const [correctionClockOut, setCorrectionClockOut] = useState(
    "2026-04-23T18:05:00",
  );

  const dashboardQuery = useQuery({
    ...trpc.workforce.dashboard.queryOptions({ focus: "MOBILE" }),
    enabled: ready,
    retry: 1,
  });

  const payrollFrequency =
    dashboardQuery.data?.company.payrollFrequency ?? "WEEKLY";

  const payrollQuery = useQuery({
    ...trpc.workforce.payrollPreview.queryOptions({
      frequency: payrollFrequency,
    }),
    enabled: ready && dashboardQuery.data?.viewer.role !== "EMPLOYEE",
    retry: 1,
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const dashboard = dashboardQuery.data;

    if (
      !ready ||
      !dashboard ||
      dashboard.viewer.role !== "EMPLOYEE" ||
      dashboard.viewer.faceEnrolled
    ) {
      return;
    }

    router.replace({
      params: {
        mode: "enroll",
        required: "1",
      },
      pathname: "/face-scan",
    });
  }, [
    dashboardQuery.data?.viewer.email,
    dashboardQuery.data?.viewer.faceEnrolled,
    dashboardQuery.data?.viewer.role,
    ready,
    router,
  ]);

  const refreshDashboard = async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.workforce.dashboard.queryFilter()),
      queryClient.invalidateQueries(
        trpc.workforce.payrollPreview.queryFilter(),
      ),
      queryClient.invalidateQueries(trpc.auth.currentViewer.queryFilter()),
    ]);
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

  const leaveMutation = useMutation(
    trpc.workforce.requestLeave.mutationOptions({
      onSuccess: refreshDashboard,
    }),
  );

  const correctionMutation = useMutation(
    trpc.workforce.requestCorrection.mutationOptions({
      onSuccess: refreshDashboard,
    }),
  );

  const reviewLeaveMutation = useMutation(
    trpc.workforce.reviewLeave.mutationOptions({
      onSuccess: refreshDashboard,
    }),
  );

  const reviewCorrectionMutation = useMutation(
    trpc.workforce.reviewCorrection.mutationOptions({
      onSuccess: refreshDashboard,
    }),
  );

  const approveTimesheetMutation = useMutation(
    trpc.workforce.approveTimesheet.mutationOptions({
      onSuccess: refreshDashboard,
    }),
  );

  const selectedProfile = useMemo(
    () =>
      profiles.find(
        (entry: (typeof profiles)[number]) => entry.email === viewerEmail,
      ) ?? profiles[0],
    [profiles, viewerEmail],
  );

  const latestClosedTimesheet = dashboardQuery.data?.recentTimesheets.find(
    (entry: DashboardTimesheet) =>
      entry.status === "CLOCKED_OUT" || entry.status === "APPROVED",
  );

  if (!ready || dashboardQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0d1b2a]">
        <View className="flex-1 items-center justify-center gap-4">
          <ActivityIndicator color="#ff764a" size="large" />
          <Text className="text-base text-white/80">
            Loading WorkForcePro workspace...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <SafeAreaView className="flex-1 bg-[#0d1b2a]">
        <View className="flex-1 justify-center gap-4 px-6">
          <Text className="text-center text-2xl font-semibold text-white">
            WorkForcePro could not reach the backend.
          </Text>
          <Text className="text-center text-base leading-7 text-white/75">
            The mobile app is trying to load data from {apiBaseUrl}. Make sure
            the Next.js backend is running on that URL, then try again.
          </Text>
          <Text className="rounded-2xl border border-[#ff764a]/30 bg-[#ff764a]/10 px-4 py-3 text-sm leading-6 text-[#ffd0c3]">
            {dashboardQuery.error.message}
          </Text>
          <Pressable
            className="rounded-2xl bg-[#ff764a] px-4 py-4"
            onPress={() => void dashboardQuery.refetch()}
          >
            <Text className="text-center text-sm font-semibold text-white">
              Retry
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const dashboard = dashboardQuery.data;

  if (!dashboard) {
    return (
      <SafeAreaView className="flex-1 bg-[#0d1b2a]">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-lg text-white">
            Unable to load the workforce dashboard.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isBusy = startBreakMutation.isPending || endBreakMutation.isPending;
  const alerts = dashboard.alerts.filter((alert): alert is DashboardAlert =>
    Boolean(alert),
  );
  const activeTimer = formatElapsedTime(
    dashboard.today.activeTimesheet?.clockInAt,
    now,
  );

  const openFaceScan = (mode: "clockIn" | "clockOut" | "enroll") => {
    router.push({
      params: {
        mode,
      },
      pathname: "/face-scan",
    });
  };

  const handleProfileChange = (email: string) => {
    void setViewerEmail(email).then(refreshDashboard);
  };

  const handleSubmitLeave = () => {
    leaveMutation.mutate({
      endDate: leaveEndDate,
      reason: leaveReason,
      startDate: leaveStartDate,
      type: leaveType,
    });
  };

  const handleSubmitCorrection = () => {
    if (!latestClosedTimesheet) {
      return;
    }

    correctionMutation.mutate({
      reason: correctionReason,
      requestedClockOutAt:
        isoFromClockField(correctionClockOut) ?? new Date().toISOString(),
      timesheetId: latestClosedTimesheet.id,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0d1b2a]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <View className="absolute left-[-72] top-[-24] h-56 w-56 rounded-full bg-[#ff764a]/25" />
        <View className="absolute right-[-60] top-36 h-64 w-64 rounded-full bg-[#4ecdc4]/12" />

        <DashboardHeader
          dashboard={dashboard}
          onSelectProfile={handleProfileChange}
          onSignOut={() => void signOut()}
          profiles={profiles}
          selectedProfile={selectedProfile}
          viewerEmail={viewerEmail}
        />

        <TodayPanel
          activeTimer={activeTimer}
          dashboard={dashboard}
          isBusy={isBusy}
          onClockIn={() => openFaceScan("clockIn")}
          onClockOut={() => openFaceScan("clockOut")}
          onCreateFaceScan={() => openFaceScan("enroll")}
          onEndBreak={() => endBreakMutation.mutate({})}
          onStartBreak={() =>
            startBreakMutation.mutate({
              note: "Meal break started from the mobile console.",
            })
          }
        />

        <View className="mt-5 gap-4">
          {alerts.map((alert) => (
            <QueueRow
              key={`${alert.title}-${alert.detail}`}
              detail={alert.detail}
              title={alert.title}
            />
          ))}
        </View>

        <View className="mt-5 gap-5">
          <EmployeeSelfServiceSections
            correctionClockOut={correctionClockOut}
            correctionReason={correctionReason}
            dashboard={dashboard}
            latestClosedTimesheet={latestClosedTimesheet}
            leaveEndDate={leaveEndDate}
            leaveReason={leaveReason}
            leaveStartDate={leaveStartDate}
            leaveType={leaveType}
            onCorrectionClockOutChange={setCorrectionClockOut}
            onCorrectionReasonChange={setCorrectionReason}
            onLeaveEndDateChange={setLeaveEndDate}
            onLeaveReasonChange={setLeaveReason}
            onLeaveStartDateChange={setLeaveStartDate}
            onLeaveTypeChange={setLeaveType}
            onSubmitCorrection={handleSubmitCorrection}
            onSubmitLeave={handleSubmitLeave}
          />

          <ManagerConsole
            dashboard={dashboard}
            onApproveTimesheet={(timesheetId) =>
              approveTimesheetMutation.mutate({
                signature: dashboard.viewer.name,
                timesheetId,
              })
            }
            onReviewCorrection={(correctionId, status) =>
              reviewCorrectionMutation.mutate({
                correctionId,
                resolutionNote:
                  status === "APPROVED"
                    ? "Approved after manager review on mobile."
                    : "Rejected after manager review on mobile.",
                status,
              })
            }
            onReviewLeave={(leaveRequestId, status) =>
              reviewLeaveMutation.mutate({
                comment:
                  status === "APPROVED"
                    ? "Approved from mobile review queue."
                    : "Declined from mobile review queue.",
                leaveRequestId,
                status,
              })
            }
            payrollData={payrollQuery.data}
          />

          <AuditTrailSection dashboard={dashboard} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
