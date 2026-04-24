import { db } from "../src/client";
import { ensureDemoData } from "../src/demo";

async function main() {
  await ensureDemoData(db);
}

main()
  .catch((error) => {
    console.error("Failed to seed WorkForcePro demo data", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
