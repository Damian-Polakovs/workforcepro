import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";

import { DemoSessionProvider } from "~/utils/auth";
import { queryClient, setClerkTokenGetter } from "~/utils/api";

import "../styles.css";

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

if (!clerkPublishableKey) {
  throw new Error(
    "Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to the mobile .env file",
  );
}

function ClerkTokenBridge(props: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setClerkTokenGetter(null);
      return;
    }

    setClerkTokenGetter(() => getToken());

    return () => {
      setClerkTokenGetter(null);
    };
  }, [getToken, isLoaded, isSignedIn]);

  return props.children;
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <ClerkTokenBridge>
          <DemoSessionProvider>
            <Stack
              screenOptions={{
                contentStyle: {
                  backgroundColor: "#0d1b2a",
                },
                headerShown: false,
              }}
            />
            <StatusBar style="light" />
          </DemoSessionProvider>
        </ClerkTokenBridge>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
