"use client";

import { UserButton } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DEMO_VIEWER_STORAGE_KEY } from "@acme/validators";

import { useTRPC } from "~/trpc/react";

function MetricTile(props: { label: string; value: string }) {
  return (
    <div className="rounded-[26px] border border-slate-900/10 bg-white/70 p-5 shadow-[0_20px_60px_-34px_rgba(19,41,61,0.4)] backdrop-blur">
      <p className="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">
        {props.label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">
        {props.value}
      </p>
    </div>
  );
}

function Panel(props: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-[30px] border border-slate-900/10 bg-white/72 p-6 shadow-[0_24px_70px_-40px_rgba(19,41,61,0.45)] backdrop-blur">
      <h2 className="text-xl font-semibold text-slate-900">{props.title}</h2>
      <div className="mt-5">{props.children}</div>
    </section>
  );
}

export function WorkforceDashboard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const profilesQuery = useQuery(trpc.auth.demoProfiles.queryOptions());
  const dashboardQuery = useQuery(
    trpc.workforce.dashboard.queryOptions({ focus: "OPS" }),
  );

  const payrollQuery = useQuery({
    ...trpc.workforce.payrollPreview.queryOptions({
      frequency: (dashboardQuery.data?.company.payrollFrequency ?? "WEEKLY") as
        | "FORTNIGHTLY"
        | "MONTHLY"
        | "WEEKLY",
    }),
    enabled: dashboardQuery.data?.viewer.role !== "EMPLOYEE",
  });

  const refresh = async () => {
    await Promise.all([queryClient.invalidateQueries(), Promise.resolve()]);
  };

  const reviewLeaveMutation = useMutation(
    trpc.workforce.reviewLeave.mutationOptions({
      onSuccess: refresh,
    }),
  );

  const reviewCorrectionMutation = useMutation(
    trpc.workforce.reviewCorrection.mutationOptions({
      onSuccess: refresh,
    }),
  );

  const approveTimesheetMutation = useMutation(
    trpc.workforce.approveTimesheet.mutationOptions({
      onSuccess: refresh,
    }),
  );

  const profiles = profilesQuery.data ?? [];
  const setViewer = async (email: string) => {
    window.localStorage.setItem(DEMO_VIEWER_STORAGE_KEY, email);
    await refresh();
  };

  if (dashboardQuery.isLoading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6 py-20">
        <div className="rounded-full border border-slate-900/10 bg-white/75 px-6 py-4 text-sm font-semibold text-slate-700 shadow-lg backdrop-blur">
          Loading operations workspace...
        </div>
      </main>
    );
  }

  const dashboard = dashboardQuery.data;

  if (!dashboard) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-20">
        <div className="rounded-[30px] border border-slate-900/10 bg-white/80 p-10 text-center shadow-xl backdrop-blur">
          <h1 className="text-3xl font-semibold text-slate-900">
            Dashboard unavailable
          </h1>
          <p className="mt-3 text-slate-600">
            The workforce backend did not return data for the selected profile.
          </p>
        </div>
      </main>
    );
  }

  const alerts = dashboard.alerts.filter(
    (alert): alert is NonNullable<(typeof dashboard.alerts)[number]> =>
      Boolean(alert),
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 md:px-8">
      <section className="rounded-[34px] border border-slate-900/10 bg-[#13293d] px-7 py-8 text-white shadow-[0_36px_100px_-50px_rgba(19,41,61,0.8)]">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-slate-300 uppercase">
              WorkForcePro operations
            </p>
            <h1 className="mt-4 max-w-3xl text-5xl leading-tight font-semibold">
              Workforce control for time, leave, schedules, approvals, and
              payroll readiness.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              {dashboard.viewer.defaultProfile}
            </p>
          </div>

          <div className="max-w-xl">
            <div className="flex items-center gap-3">
              <UserButton />
              <p className="text-sm text-slate-300">
                Active profile:{" "}
                <span className="font-semibold text-white">
                  {dashboard.viewer.name}
                </span>
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {profiles.map((profile) => (
                <button
                  key={profile.email}
                  className={`rounded-full px-4 py-2 text-xs font-semibold tracking-[0.2em] uppercase transition ${
                    dashboard.viewer.email === profile.email
                      ? "bg-[#ff764a] text-white"
                      : "border border-white/15 bg-white/5 text-slate-200 hover:bg-white/12"
                  }`}
                  onClick={() => void setViewer(profile.email)}
                  type="button"
                >
                  {profile.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Hours this cycle"
          value={`${dashboard.stats.hoursThisCycle.toFixed(1)}h`}
        />
        <MetricTile
          label="Overtime"
          value={`${dashboard.stats.overtimeHours.toFixed(1)}h`}
        />
        <MetricTile
          label="Punctuality"
          value={`${dashboard.stats.punctualityScore}%`}
        />
        <MetricTile
          label="Gross pay"
          value={`EUR ${dashboard.stats.grossPay.toFixed(2)}`}
        />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Panel title="Operations board">
          <div className="grid gap-4 md:grid-cols-2">
            {alerts.map((alert) => (
              <div
                key={`${alert.title}-${alert.detail}`}
                className="rounded-[24px] border border-slate-900/10 bg-[#f7fafb] p-4"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {alert.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {alert.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3">
            {dashboard.teamBoard.map((member) => (
              <div
                key={member.name}
                className="grid gap-2 rounded-[24px] border border-slate-900/10 bg-white/70 p-4 md:grid-cols-[1.3fr_0.9fr_0.7fr_0.7fr]"
              >
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    {member.name}
                  </p>
                  <p className="text-sm text-slate-500">{member.team}</p>
                </div>
                <p className="text-sm font-medium text-slate-700">
                  {member.currentStatus}
                </p>
                <p className="text-sm text-slate-600">
                  {member.hoursThisCycle.toFixed(1)}h
                </p>
                <p className="text-sm text-slate-600">
                  {member.latenessCount} late / {member.openItems} open
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Approvals">
          {dashboard.viewer.role !== "EMPLOYEE" ? (
            <div className="space-y-4">
              <div className="rounded-[24px] bg-[#f7fafb] p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Queue summary
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {dashboard.queue.pendingLeave} leave requests,{" "}
                  {dashboard.queue.pendingCorrections} corrections, and{" "}
                  {dashboard.queue.pendingTimesheets} clocked-out timesheets are
                  waiting for review.
                </p>
              </div>

              {dashboard.pendingLeave.map((leave) => (
                <div
                  key={leave.id}
                  className="rounded-[24px] border border-slate-900/10 bg-white/70 p-4"
                >
                  <p className="text-base font-semibold text-slate-900">
                    {leave.userName} - {leave.type}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {leave.reason}
                  </p>
                  <div className="mt-4 flex gap-3">
                    <button
                      className="rounded-full border border-slate-900/10 px-4 py-2 text-sm font-semibold text-slate-700"
                      onClick={() =>
                        reviewLeaveMutation.mutate({
                          comment: "Declined from the web operations queue.",
                          leaveRequestId: leave.id,
                          status: "DECLINED",
                        })
                      }
                      type="button"
                    >
                      Decline
                    </button>
                    <button
                      className="rounded-full bg-[#ff764a] px-4 py-2 text-sm font-semibold text-white"
                      onClick={() =>
                        reviewLeaveMutation.mutate({
                          comment: "Approved from the web operations queue.",
                          leaveRequestId: leave.id,
                          status: "APPROVED",
                        })
                      }
                      type="button"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))}

              {dashboard.pendingCorrections.map((correction) => (
                <div
                  key={correction.id}
                  className="rounded-[24px] border border-slate-900/10 bg-white/70 p-4"
                >
                  <p className="text-base font-semibold text-slate-900">
                    {correction.userName}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {correction.reason}
                  </p>
                  <div className="mt-4 flex gap-3">
                    <button
                      className="rounded-full border border-slate-900/10 px-4 py-2 text-sm font-semibold text-slate-700"
                      onClick={() =>
                        reviewCorrectionMutation.mutate({
                          correctionId: correction.id,
                          resolutionNote:
                            "Rejected from the web operations queue.",
                          status: "REJECTED",
                        })
                      }
                      type="button"
                    >
                      Reject
                    </button>
                    <button
                      className="rounded-full bg-[#4ecdc4] px-4 py-2 text-sm font-semibold text-slate-900"
                      onClick={() =>
                        reviewCorrectionMutation.mutate({
                          correctionId: correction.id,
                          resolutionNote:
                            "Approved from the web operations queue.",
                          status: "APPROVED",
                        })
                      }
                      type="button"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))}

              {dashboard.recentTimesheets
                .filter((entry) => entry.status === "CLOCKED_OUT")
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-[24px] border border-slate-900/10 bg-white/70 p-4"
                  >
                    <p className="text-base font-semibold text-slate-900">
                      {entry.label}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Ready for digital signature approval.
                    </p>
                    <button
                      className="mt-4 rounded-full bg-[#13293d] px-4 py-2 text-sm font-semibold text-white"
                      onClick={() =>
                        approveTimesheetMutation.mutate({
                          signature: dashboard.viewer.name,
                          timesheetId: entry.id,
                        })
                      }
                      type="button"
                    >
                      Approve timesheet
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            <div className="rounded-[24px] bg-[#f7fafb] p-4 text-sm leading-6 text-slate-600">
              Employee profiles use the mobile time clock and leave tools.
              Switch back to a manager or admin profile to review payroll queues
              here.
            </div>
          )}
        </Panel>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Payroll preview">
          {dashboard.viewer.role !== "EMPLOYEE" && payrollQuery.data ? (
            <div className="space-y-4">
              <div className="rounded-[24px] bg-[#f7fafb] p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {payrollQuery.data.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {payrollQuery.data.totals.employees} staff · EUR{" "}
                  {payrollQuery.data.totals.grossPay.toFixed(2)} gross ·{" "}
                  {payrollQuery.data.totals.overtimeHours.toFixed(1)} overtime
                  hours
                </p>
              </div>

              <div className="space-y-3">
                {payrollQuery.data.rows.map((row) => (
                  <div
                    key={row.employee}
                    className="grid gap-2 rounded-[22px] border border-slate-900/10 bg-white/70 p-4 md:grid-cols-[1.2fr_0.8fr_0.8fr]"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {row.employee}
                      </p>
                      <p className="text-sm text-slate-500">{row.team}</p>
                    </div>
                    <p className="text-sm text-slate-600">
                      {row.regularHours.toFixed(1)}h regular /{" "}
                      {row.overtimeHours.toFixed(1)}h overtime
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      EUR {row.grossPay.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              <pre className="overflow-x-auto rounded-[24px] bg-[#0f1f2f] p-4 text-xs leading-6 text-slate-100">
                {payrollQuery.data.csv}
              </pre>
            </div>
          ) : (
            <div className="rounded-[24px] bg-[#f7fafb] p-4 text-sm leading-6 text-slate-600">
              Payroll preview is available from manager and admin views only.
            </div>
          )}
        </Panel>

        <Panel title="Audit trail">
          <div className="space-y-3">
            {dashboard.auditTrail.map((entry) => (
              <div
                key={`${entry.action}-${new Date(entry.createdAt).toISOString()}`}
                className="rounded-[24px] border border-slate-900/10 bg-white/70 p-4"
              >
                <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">
                  {entry.entityType}
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {entry.summary}
                </p>
                <p className="mt-2 text-sm text-slate-600">{entry.actor}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </main>
  );
}
