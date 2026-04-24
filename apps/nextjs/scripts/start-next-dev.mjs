import { spawn } from "node:child_process";
import { open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const lockPath = path.join(appDir, ".next", "dev", "lock");

function isNextLockError(output) {
  const text = output.toLowerCase();
  return (
    text.includes("unable to acquire lock") &&
    text.includes("another instance of next dev running")
  );
}

async function isLockHeldByAnotherProcess(filePath) {
  try {
    const handle = await open(filePath, "r+");
    await handle.close();
    return false;
  } catch (error) {
    return error?.code === "EBUSY" || error?.code === "EPERM";
  }
}

function startNextDev() {
  const command = process.platform === "win32" ? "cmd.exe" : "next";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "next", "dev"]
      : ["dev"];

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
