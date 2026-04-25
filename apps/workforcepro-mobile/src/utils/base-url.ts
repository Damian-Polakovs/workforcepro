import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const defaultApiPort = "3000";
const fallbackLocalPort = "3001";
const localhostCandidateHosts = ["localhost", "127.0.0.1"] as const;

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

const isLoopbackHost = (host: string) => loopbackHosts.has(host.toLowerCase());
const isPrivateIpv4Host = (host: string) => {
  const octets = host.split(".").map((segment) => Number.parseInt(segment, 10));

  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) {
    return false;
  }

  const [first, second] = octets;
  if (first === 10) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  return false;
};
const isLikelyLocalHost = (host: string) =>
  isLoopbackHost(host) || isPrivateIpv4Host(host);

const getHostFromUri = (uri?: string | null) => {
  if (!uri) return null;

  const value = uri.includes("://") ? uri : `http://${uri}`;

  try {
    return new URL(value).hostname || null;
  } catch {
    return uri.split(":")[0] || null;
  }
};

const getMetroScriptHost = () => {
  const sourceCode = NativeModules.SourceCode as
    | { scriptURL?: string | null }
    | undefined;
  return getHostFromUri(sourceCode?.scriptURL ?? null);
};

const getExpoDevHost = () => {
  const expoGoConfig = Constants.expoGoConfig as
    | { debuggerHost?: string }
    | null;
  const manifest = Constants.manifest as
    | { debuggerHost?: string; hostUri?: string }
    | null;

  const host =
    getMetroScriptHost() ??
    getHostFromUri(Constants.expoConfig?.hostUri) ??
    getHostFromUri(expoGoConfig?.debuggerHost) ??
    getHostFromUri(manifest?.hostUri) ??
    getHostFromUri(manifest?.debuggerHost);

  if (!host) return null;

  if (Platform.OS === "android" && isLoopbackHost(host)) {
    return "10.0.2.2";
  }

  return host;
};

const normalizeConfiguredUrl = (configured: string, expoHost: string | null) => {
  const normalized = trimTrailingSlash(configured);

  if (Platform.OS === "web" || !expoHost) {
    return normalized;
  }

  try {
    const url = new URL(normalized);

    if (!isLoopbackHost(url.hostname)) {
      return normalized;
    }

    url.hostname = expoHost;
    return trimTrailingSlash(url.toString());
  } catch {
    return trimTrailingSlash(
      normalized
        .replace("localhost", expoHost)
        .replace("127.0.0.1", expoHost),
    );
  }
};

const appendUniqueUrl = (urls: string[], value: string) => {
  const normalized = trimTrailingSlash(value);
  if (!urls.includes(normalized)) {
    urls.push(normalized);
  }
};

const getHostFromUrl = (value: string) => {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
};

const getLocalFallbackHosts = (expoHost: string | null) => {
  const hosts: string[] = [];

  if (expoHost) {
    hosts.push(expoHost);
  }

  if (Platform.OS === "android") {
    hosts.push("10.0.2.2");
  }

  hosts.push(...localhostCandidateHosts);
  return hosts;
};

const getLocalFallbackPorts = () => {
  const envPort = process.env.EXPO_PUBLIC_API_PORT?.trim();
  const ports = [envPort, defaultApiPort, fallbackLocalPort].filter(
    (value): value is string => Boolean(value),
  );
  return [...new Set(ports)];
};

export const getBaseUrlCandidates = () => {
  const configuredValue = process.env.EXPO_PUBLIC_API_URL?.trim();
  const expoHost = getExpoDevHost();
  const candidates: string[] = [];
  const configured = configuredValue
    ? normalizeConfiguredUrl(configuredValue, expoHost)
    : null;

  if (configured) {
    appendUniqueUrl(candidates, configured);
  }

  if (!configured && !expoHost) {
    throw new Error(
      "Failed to resolve the API host. Set EXPO_PUBLIC_API_URL to your Next.js server.",
    );
  }

  const configuredHost = configured ? getHostFromUrl(configured) : null;
  const shouldAddLocalFallbacks =
    !configuredHost || isLikelyLocalHost(configuredHost);

  if (shouldAddLocalFallbacks) {
    const fallbackPorts = getLocalFallbackPorts();
    for (const host of getLocalFallbackHosts(expoHost)) {
      for (const port of fallbackPorts) {
        appendUniqueUrl(candidates, `http://${host}:${port}`);
      }
    }
  }

  return candidates;
};

export const getBaseUrl = () => getBaseUrlCandidates()[0];
