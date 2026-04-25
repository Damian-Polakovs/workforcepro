import { useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import type { DashboardData, PayrollFrequency } from "~/types/api";
import { trpc } from "~/utils/api";
import {
  ActionButton,
  EmptyState,
  formatDateTime,
  KeyValue,
  MetricTile,
  money,
  pendingApprovalCount,
  Pill,
  ScreenTitle,
  SectionCard,
  showInfo,
  StatusRow,
  styles,
  toTitleCase,
} from "./shared";

const payrollFrequencies: PayrollFrequency[] = [
  "WEEKLY",
  "FORTNIGHTLY",
  "MONTHLY",
];

export function AdminDashboard(props: {
  activeTab: string;
  dashboard: DashboardData;
  setActiveTab: (tab: string) => void;
}) {
  if (props.activeTab === "payroll") {
    return <AdminPayrollScreen dashboard={props.dashboard} />;
  }
  if (props.activeTab === "rules") {
    return <AdminRulesScreen dashboard={props.dashboard} />;
  }
  if (props.activeTab === "audit") {
    return <AdminAuditScreen dashboard={props.dashboard} />;
  }
  return (
    <AdminHomeScreen
      dashboard={props.dashboard}
      setActiveTab={props.setActiveTab}
    />
  );
}

function AdminHomeScreen(props: {
  dashboard: DashboardData;
  setActiveTab: (tab: string) => void;
}) {
  const employeeCount =
    props.dashboard.payroll?.totals.employees ??
    props.dashboard.teamBoard.length;
  const activeNow = props.dashboard.teamBoard.filter((member) =>
    member.currentStatus.toLowerCase().includes("clocked"),
  ).length;
  const approvals = pendingApprovalCount(props.dashboard);
  const auditItems = props.dashboard.auditTrail.length;

  return (
    <View style={styles.stack}>
      <ScreenTitle title="Admin dashboard" />
      <View style={styles.metricGrid}>
        <MetricTile
          icon="employees"
          label="Employees"
          onPress={() =>
            showInfo("Employees", [
              ["Employees in payroll preview", employeeCount],
              ["Team records returned", props.dashboard.teamBoard.length],
              ["Company", props.dashboard.company.name],
            ])
          }
          value={String(employeeCount)}
        />
        <MetricTile
          icon="active"
          label="Active now"
          onPress={() =>
            showInfo("Active now", [
              ["Clocked in", activeNow],
              ["Rostered staff returned", props.dashboard.teamBoard.length],
            ])
          }
          tone="success"
          value={String(activeNow)}
        />
      </View>

      <SectionCard title="Operations queues">
        {props.dashboard.payroll ? (
          <StatusRow
            label={props.dashboard.payroll.label}
            onPress={() => props.setActiveTab("payroll")}
            status={toTitleCase(props.dashboard.payroll.frequency)}
            tone="info"
          />
        ) : (
          <EmptyState
            detail="The API returned no payroll preview for this viewer."
            title="No payroll preview"
          />
        )}
        <View style={styles.metricGrid}>
          <MetricTile
            icon="approvals"
            label="Pending approvals"
            onPress={() =>
              showInfo("Pending approvals", [
                ["Timesheets", props.dashboard.queue.pendingTimesheets],
                ["Corrections", props.dashboard.queue.pendingCorrections],
                ["Leave requests", props.dashboard.queue.pendingLeave],
              ])
            }
            tone={approvals > 0 ? "warning" : undefined}
            value={String(approvals)}
          />
          <MetricTile
            icon="audit"
            label="Audit entries"
            onPress={() =>
              showInfo("Audit entries", [
                ["Entries returned", auditItems],
                ["Late incidents", props.dashboard.stats.lateIncidents],
                ["Absences", props.dashboard.stats.absences],
              ])
            }
            value={String(auditItems)}
          />
        </View>
      </SectionCard>

      <SectionCard title="Quick actions">
        <ActionButton
          label="Run payroll export"
          onPress={() => props.setActiveTab("payroll")}
          variant="primary"
        />
        <ActionButton
          label="View audit trail"
          onPress={() => props.setActiveTab("audit")}
        />
        <ActionButton
          label="Manage pay rules"
          onPress={() => props.setActiveTab("rules")}
        />
      </SectionCard>
    </View>
  );
}

function AdminRulesScreen(props: { dashboard: DashboardData }) {
  const company = props.dashboard.company;

  return (
    <View style={styles.stack}>
      <ScreenTitle title="Pay rules config" />
      <SectionCard title="Company rules">
        <KeyValue
          label="Payroll frequency"
          value={toTitleCase(company.payrollFrequency)}
        />
        <KeyValue label="Standard day" value={`${company.standardDayHours}h`} />
        <KeyValue
          label="Standard week"
          value={`${company.standardWeekHours}h`}
        />
        <KeyValue
          label="Weekly OT threshold"
          value={`${company.overtimeWeeklyThreshold}h`}
        />
        <KeyValue
          label="Daily OT threshold"
          value={`${company.overtimeDailyThreshold}h`}
        />
      </SectionCard>

      <SectionCard title="Premiums">
        <KeyValue
          label="Overtime multiplier"
          tone="success"
          value={`x${company.overtimeMultiplier}`}
        />
        <KeyValue
          label="Bank holiday multiplier"
          tone="success"
          value={`x${company.bankHolidayMultiplier}`}
        />
      </SectionCard>

      <ActionButton
        label="View rule details"
        onPress={() =>
          showInfo("Pay rules", [
            ["Company", company.name],
            ["Currency", company.currency],
            ["Timezone", company.timezone],
            ["Payroll frequency", toTitleCase(company.payrollFrequency)],
            ["Standard day", `${company.standardDayHours}h`],
            ["Standard week", `${company.standardWeekHours}h`],
            ["Overtime multiplier", `x${company.overtimeMultiplier}`],
            ["Bank holiday multiplier", `x${company.bankHolidayMultiplier}`],
          ])
        }
        variant="primary"
      />
    </View>
  );
}

function AdminPayrollScreen(props: { dashboard: DashboardData }) {
  const [frequency, setFrequency] = useState<PayrollFrequency>(
    props.dashboard.payroll?.frequency ??
      props.dashboard.company.payrollFrequency,
  );
  const [open, setOpen] = useState(false);
  const payrollQuery = useQuery(
    trpc.workforce.payrollPreview.queryOptions({ frequency }),
  );
  const preview =
    payrollQuery.data ??
    (props.dashboard.payroll?.frequency === frequency
      ? props.dashboard.payroll
      : null);
  const sharePayrollExport = async (format: "CSV" | "PDF") => {
    if (!preview) {
      return;
    }

    await Share.share({
      message:
        format === "CSV"
          ? preview.csv
          : [
              `${preview.label} - ${toTitleCase(preview.frequency)}`,
              `Employees: ${preview.totals.employees}`,
              `Regular hours: ${preview.totals.regularHours.toFixed(1)}h`,
              `Overtime hours: ${preview.totals.overtimeHours.toFixed(1)}h`,
              `Gross payroll: ${money(
                preview.totals.grossPay,
                props.dashboard.company.currency,
              )}`,
            ].join("\n"),
      title: `Payroll ${format} export`,
    });
  };

  return (
    <View style={styles.stack}>
      <ScreenTitle title="Payroll export" />
      <SectionCard title="Pay period">
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen((value) => !value)}
          style={({ pressed }) => [
            styles.selectBox,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.selectText}>
            {preview?.label
              ? `${preview.label} - ${toTitleCase(frequency)}`
              : toTitleCase(frequency)}
          </Text>
          <Text style={styles.selectCaret}>{open ? "^" : "v"}</Text>
        </Pressable>
        {open
          ? payrollFrequencies.map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item}
                onPress={() => {
                  setFrequency(item);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.selectOption,
                  item === frequency ? styles.selectOptionActive : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.selectText}>{toTitleCase(item)}</Text>
              </Pressable>
            ))
          : null}
      </SectionCard>

      <SectionCard title="Summary">
        {preview ? (
          <>
            <KeyValue
              label="Employees"
              value={String(preview.totals.employees)}
            />
            <KeyValue
              label="Regular hours"
              value={`${preview.totals.regularHours.toFixed(1)}h`}
            />
            <KeyValue
              label="Overtime hours"
              tone={preview.totals.overtimeHours > 0 ? "success" : undefined}
              value={`${preview.totals.overtimeHours.toFixed(1)}h`}
            />
            <View style={styles.divider} />
            <KeyValue
              label="Gross payroll"
              strong
              value={money(
                preview.totals.grossPay,
                props.dashboard.company.currency,
              )}
            />
          </>
        ) : (
          <EmptyState
            detail={
              payrollQuery.isFetching
                ? "Loading the selected payroll period."
                : "No payroll totals were returned for this period."
            }
            title="No payroll totals"
          />
        )}
      </SectionCard>

      <SectionCard title="Employees">
        {preview?.rows.length ? (
          preview.rows.slice(0, 4).map((row) => (
            <StatusRow
              key={`${row.employee}-${row.team}`}
              label={row.employee}
              onPress={() =>
                showInfo(row.employee, [
                  ["Team", row.team],
                  ["Regular hours", `${row.regularHours.toFixed(1)}h`],
                  ["Overtime hours", `${row.overtimeHours.toFixed(1)}h`],
                  [
                    "Gross pay",
                    money(row.grossPay, props.dashboard.company.currency),
                  ],
                ])
              }
              status={money(row.grossPay, props.dashboard.company.currency)}
              tone={row.overtimeHours > 0 ? "success" : "info"}
            />
          ))
        ) : (
          <EmptyState
            detail="Payroll rows will appear here when the API returns employees for this period."
            title="No payroll rows"
          />
        )}
      </SectionCard>

      <View style={styles.buttonRow}>
        <ActionButton
          disabled={!preview}
          label="Export CSV"
          onPress={() => void sharePayrollExport("CSV")}
          style={styles.flexButton}
          variant="primary"
        />
        <ActionButton
          disabled={!preview}
          label="Export PDF"
          onPress={() => void sharePayrollExport("PDF")}
          style={styles.flexButton}
        />
      </View>
    </View>
  );
}

function AdminAuditScreen(props: { dashboard: DashboardData }) {
  return (
    <View style={styles.stack}>
      <View style={styles.titleRow}>
        <ScreenTitle title="Audit trail" />
        <Pill
          label={`${props.dashboard.auditTrail.length} entries`}
          tone="info"
        />
      </View>
      <SectionCard>
        {props.dashboard.auditTrail.length ? (
          props.dashboard.auditTrail.slice(0, 6).map((entry, index) => (
            <Pressable
              accessibilityRole="button"
              key={`${entry.action}-${entry.createdAt}-${index}`}
              onPress={() =>
                showInfo(entry.entityType, [
                  ["Action", entry.action],
                  ["Actor", entry.actor],
                  ["Created", formatDateTime(entry.createdAt)],
                  ["Summary", entry.summary],
                ])
              }
              style={({ pressed }) => [
                styles.auditItem,
                pressed ? styles.pressed : null,
              ]}
            >
              <Pill
                label={entry.action.includes("flag") ? "Flag" : "Audit"}
                tone={entry.action.includes("flag") ? "danger" : "info"}
              />
              <View style={styles.auditTextWrap}>
                <Text style={styles.rowLabel}>{entry.summary}</Text>
                <Text style={styles.rowMeta}>
                  {entry.actor} - {formatDateTime(entry.createdAt)}
                </Text>
              </View>
            </Pressable>
          ))
        ) : (
          <EmptyState
            detail="The audit table did not return any entries for this company."
            title="No audit entries"
          />
        )}
      </SectionCard>
      <ActionButton
        disabled={props.dashboard.auditTrail.length === 0}
        label="Export audit log"
        onPress={() =>
          void Share.share({
            message: props.dashboard.auditTrail
              .map(
                (entry) =>
                  `${formatDateTime(entry.createdAt)} | ${entry.actor} | ${entry.action} | ${entry.summary}`,
              )
              .join("\n"),
            title: "WorkForcePro audit export",
          })
        }
        variant="primary"
      />
    </View>
  );
}
