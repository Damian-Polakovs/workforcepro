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
  getItemAsync?: (key: string) => Promise<string | null>;
  setItemAsync?: (key: string, value: string) => Promise<void>;
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

const setToLocalStorage = (email: string) => {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(DEMO_VIEWER_STORAGE_KEY, email);
  } catch {
    // Ignore storage write failures in restricted browser contexts.
  }
};

export const getActiveViewerEmail = async () => {
  if (isWeb) {
    const stored = getFromLocalStorage();
    viewerEmailCache = stored ?? defaultMobileViewerEmail;
    return stored;
  }

  if (typeof secureStoreApi.getItemAsync === "function") {
    const stored = await secureStoreApi.getItemAsync(DEMO_VIEWER_STORAGE_KEY);
    viewerEmailCache = stored ?? defaultMobileViewerEmail;
    return stored;
  }

  return viewerEmailCache;
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

export const setActiveViewerEmail = async (email: string) => {
  viewerEmailCache = email;

  if (isWeb) {
    setToLocalStorage(email);
    return;
  }

  if (typeof secureStoreApi.setItemAsync === "function") {
    await secureStoreApi.setItemAsync(DEMO_VIEWER_STORAGE_KEY, email);
  }
};
