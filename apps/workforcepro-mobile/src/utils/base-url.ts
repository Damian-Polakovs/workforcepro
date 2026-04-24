import Constants from "expo-constants";
import { Platform } from "react-native";

export const getBaseUrl = () => {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(":")[0];

  if (configured) {
    if (Platform.OS !== "web" && localhost) {
      return configured
        .replace("localhost", localhost)
        .replace("127.0.0.1", localhost)
        .replace(/\/$/, "");
    }

    return configured.replace(/\/$/, "");
  }

  if (!localhost) {
    throw new Error(
      "Failed to resolve the API host. Set EXPO_PUBLIC_API_URL to your Next.js server.",
    );
  }

  return `http://${localhost}:3000`;
};
