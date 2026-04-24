import { spawn } from "node:child_process";

function prefixAndWrite(chunk, prefix, writer) {
  const text = chunk.toString();
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.length === 0 && index === lines.length - 1) continue;
    writer(`${prefix} ${line}\n`);
  }
}

function spawnPnpm(args, options) {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", "pnpm", ...args], options);
  }

  return spawn("pnpm", args, options);
}

function spawnBackend() {
  const child = spawnPnpm(["-F", "@acme/nextjs", "dev"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  child.stdout?.on("data", (chunk) =>
    prefixAndWrite(chunk, "[backend]", (line) => process.stdout.write(line)),
  );
  child.stderr?.on("data", (chunk) =>
    prefixAndWrite(chunk, "[backend]", (line) => process.stderr.write(line)),
  );

  return child;
}

function spawnMobileInteractive() {
  const interactiveTerminal = Boolean(
    process.stdin.isTTY && process.stdout.isTTY && process.stderr.isTTY,
  );

  const child = spawnPnpm(["-F", "@workforcepro/mobile", "dev"], {
    stdio: interactiveTerminal ? "inherit" : ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  if (!interactiveTerminal) {
    child.stdout?.on("data", (chunk) =>
      prefixAndWrite(chunk, "[mobile]", (line) => process.stdout.write(line)),
    );
    child.stderr?.on("data", (chunk) =>
      prefixAndWrite(chunk, "[mobile]", (line) => process.stderr.write(line)),
    );
  }

  return child;
}

function shutdown(child, signal = "SIGTERM") {
  if (!child || child.killed) return;
  try {
    child.kill(signal);
  } catch {
    // No-op: child may already be closed.
  }
}

async function main() {
  const backend = spawnBackend();
  const mobile = spawnMobileInteractive();

  const stopAll = (signal) => {
    shutdown(backend, signal);
    shutdown(mobile, signal);
  };

  process.on("SIGINT", () => {
    stopAll("SIGINT");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    stopAll("SIGTERM");
    process.exit(0);
  });

  backend.on("exit", (code) => {
    if ((code ?? 0) !== 0) {
      process.stderr.write(
        `[backend] exited with code ${code}. Stopping mobile server.\n`,
      );
      shutdown(mobile, "SIGTERM");
      process.exit(code ?? 1);
    }
  });

  mobile.on("exit", (code, signal) => {
    shutdown(backend, "SIGTERM");
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
