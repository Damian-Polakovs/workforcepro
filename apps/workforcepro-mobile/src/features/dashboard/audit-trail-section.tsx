import { View } from "react-native";

import type { DashboardData } from "./types";
import { QueueRow, Section } from "./components";

export function AuditTrailSection(props: { dashboard: DashboardData }) {
  return (
    <Section title="Audit trail">
      <View className="gap-3">
        {props.dashboard.auditTrail.map((entry) => (
          <QueueRow
            key={`${entry.action}-${entry.createdAt}`}
            detail={`${entry.actor} | ${entry.summary}`}
            title={entry.entityType}
          />
        ))}
      </View>
    </Section>
  );
}
