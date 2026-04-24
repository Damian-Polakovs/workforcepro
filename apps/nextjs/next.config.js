import { createJiti } from "jiti";
import path from "node:path";
import { fileURLToPath } from "node:url";

const jiti = createJiti(import.meta.url);
const nextAppDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(nextAppDir, "../..");

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
await jiti.import("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@acme/api",
    "@acme/db",
    "@acme/ui",
    "@acme/validators",
  ],

  /** We already do linting and typechecking as separate tasks in CI */
  typescript: { ignoreBuildErrors: true },
  turbopack: {
    root: monorepoRoot,
  },
};

export default config;
