import { spawn } from "node:child_process";
import { open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const lockPath = path.join(appDir, ".next", "dev", "lock");
const devHost = process.env.NEXT_DEV_HOST?.trim() || "0.0.0.0";
const devPort = Number.parseInt(process.env.PORT?.trim() ?? "", 10) || 3000;
const healthCheckPath = "/api/trpc/workforce.dashboard";
const healthCheckTimeoutMs = 4_000;
const requestedBundler =
  process.env.NEXT_DEV_BUNDLER?.trim().toLowerCase() ?? "webpack";
const useTurbopack =
  requestedBundler === "turbo" || requestedBundler === "turbopack";

if (
  requestedBundler !== "webpack" &&
  requestedBundler !== "turbo" &&
  requestedBundler !== "turbopack"
) {
  console.warn(
    `Unrecognized NEXT_DEV_BUNDLER="${requestedBundler}". Falling back to webpack.`,
  );
}

function getNextDevArgs() {
  const args = ["dev", "--hostname", devHost];
  const port = process.env.PORT?.trim();

  if (port) {
    args.push("--port", port);
  }

  args.push(useTurbopack ? "--turbo" : "--webpack");
  return args;
}

/**
 * @param {string} output
 */
function isNextLockError(output) {
  const text = output.toLowerCase();
  return (
    text.includes("unable to acquire lock") &&
    text.includes("another instance of next dev running")
  );
}

/**
 * @param {string} filePath
 */
async function isLockHeldByAnotherProcess(filePath) {
  try {
    const handle = await open(filePath, "r+");
    await handle.close();
    return false;
  } catch (error) {
    if (!(error instanceof Error)) {
      return false;
    }

    const code = /** @type {NodeJS.ErrnoException} */ (error).code;
    return code === "EBUSY" || code === "EPERM";
  }
}

function startNextDev() {
  const command = process.platform === "win32" ? "cmd.exe" : "next";
  const nextArgs = getNextDevArgs();
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "next", ...nextArgs]
      : nextArgs;

  const child = spawn(command, args, {
    stdio: ["inherit", "pipe", "pipe"],
    cwd: appDir,
    env: process.env,
  });

  let output = "";

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(text);
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stderr.write(text);
  });

  return { child, getOutput: () => output };
}

async function isServerHealthy() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), healthCheckTimeoutMs);

  try {
    const response = await fetch(
      `http://127.0.0.1:${devPort}${healthCheckPath}`,
      {
        method: "OPTIONS",
        signal: controller.signal,
      },
    );
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const { child, getOutput } = startNextDev();

  const exitResult = await new Promise((resolve) => {
    child.on("exit", (code, signal) => resolve({ code, signal }));
    child.on("error", (error) => resolve({ code: 1, signal: null, error }));
  });

  if (exitResult.error) {
    console.error(exitResult.error);
    process.exit(1);
    return;
  }

  if (exitResult.signal) {
    process.kill(process.pid, exitResult.signal);
    return;
  }

  const code = exitResult.code ?? 1;
  if (code === 0) {
    process.exit(0);
    return;
  }

  const output = getOutput();
  if (isNextLockError(output) && (await isLockHeldByAnotherProcess(lockPath))) {
    if (await isServerHealthy()) {
      console.log(
        "Next.js dev server already running for this app. Reusing existing instance.",
      );
      process.exit(0);
      return;
    }

    console.error(
      `Next.js dev lock is held, but the existing server did not respond on http://127.0.0.1:${devPort}${healthCheckPath} within ${healthCheckTimeoutMs / 1000}s.`,
    );
    console.error(
      "The existing Next.js process appears unhealthy. Stop stale Node/Next processes and start the backend again.",
    );
    process.exit(1);
    return;
  }

  if (isNextLockError(output)) {
    console.log(
      "Next.js dev server already running for this app. Reusing existing instance.",
    );
    process.exit(0);
    return;
  }

  process.exit(code);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
