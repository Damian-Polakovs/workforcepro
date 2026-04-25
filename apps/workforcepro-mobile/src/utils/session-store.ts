import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  DEMO_VIEWER_STORAGE_KEY,
  defaultDemoProfiles,
} from "~/config/demo";

export const defaultMobileViewerEmail: string =
  defaultDemoProfiles[2]?.email ?? defaultDemoProfiles[0].email;

let viewerEmailCache: string = defaultMobileViewerEmail;

const secureStoreApi = SecureStore as {
  getItem?: (key: string) => string | null;
};

const isWeb = Platform.OS === "web";

const canUseLocalStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const getFromLocalStorage = () => {
  if (!canUseLocalStorage()) return null;

  try {
    return window.localStorage.getItem(DEMO_VIEWER_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const getActiveViewerEmailSync = () => {
  if (isWeb) {
    const stored = getFromLocalStorage();
    viewerEmailCache = stored ?? defaultMobileViewerEmail;
    return stored ?? defaultMobileViewerEmail;
  }

  if (typeof secureStoreApi.getItem === "function") {
    const stored = secureStoreApi.getItem(DEMO_VIEWER_STORAGE_KEY);
    viewerEmailCache = stored ?? defaultMobileViewerEmail;
    return stored ?? defaultMobileViewerEmail;
  }

  return viewerEmailCache;
};
