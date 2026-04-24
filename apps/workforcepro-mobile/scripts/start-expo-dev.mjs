import { spawn } from "node:child_process";
import { createServer } from "node:net";

const FALLBACK_PORTS = [8081, 8082, 8083, 8084, 8085, 8086, 8087, 8088];

function parseEnvPort(value) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) return null;
  return parsed;
}

function buildCandidatePorts() {
  const preferredPort = parseEnvPort(process.env.EXPO_DEV_PORT);
  return preferredPort
    ? [preferredPort, ...FALLBACK_PORTS.filter((port) => port !== preferredPort)]
    : FALLBACK_PORTS;
}

function canBindPort(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();

    server.once("error", (error) => {
      if (error?.code === "EADDRINUSE" || error?.code === "EACCES") {
        resolve(false);
        return;
      }
      resolve(false);
    });

    // Do not bind to 127.0.0.1 only; Expo checks the global port binding.
    server.listen({ port, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function resolvePort() {
  const candidatePorts = buildCandidatePorts();

  for (const port of candidatePorts) {
    if (await canBindPort(port)) return port;
  }

  throw new Error(
    `Could not find a free Metro port. Tried: ${candidatePorts.join(", ")}`,
  );
}

async function main() {
  const port = await resolvePort();
  console.log(`Starting Expo on port ${port}...`);
  const extraArgs = process.argv.slice(2);

  const interactiveTerminal = Boolean(
    process.stdin.isTTY && process.stdout.isTTY && process.stderr.isTTY,
  );
  const command = process.platform === "win32" ? "cmd.exe" : "expo";
  const args =
    process.platform === "win32"
      ? [
          "/d",
          "/s",
          "/c",
          "expo",
          "start",
          "--port",
          String(port),
          ...extraArgs,
        ]
      : ["start", "--port", String(port), ...extraArgs];

  const child = spawn(command, args, {
    stdio: interactiveTerminal ? "inherit" : ["ignore", "pipe", "pipe"],
  });

  if (!interactiveTerminal) {
    child.stdout?.on("data", (chunk) => process.stdout.write(chunk.toString()));
    child.stderr?.on("data", (chunk) => process.stderr.write(chunk.toString()));
  }

  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
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
