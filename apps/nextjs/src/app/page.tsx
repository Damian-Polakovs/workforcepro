import { auth } from "@clerk/nextjs/server";

import { WorkforceDashboard } from "./_components/workforce-dashboard";

export default async function HomePage() {
  await auth.protect();

  return <WorkforceDashboard />;
}
