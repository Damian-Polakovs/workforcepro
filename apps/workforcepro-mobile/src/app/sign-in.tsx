import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { useAuth, useSignIn } from "@clerk/expo";

type ClerkMaybeError = {
  longMessage?: string;
  message?: string;
} | null;

const getErrorMessage = (error: ClerkMaybeError, fallback: string) =>
  error?.longMessage ?? error?.message ?? fallback;

const workforceLogo = require("../../assets/workforce-pro-logo.png");

const normalizeDecoratedRoute = (url: string) => {
  if (!url) {
    return "/dashboard";
  }

  if (url.startsWith("/")) {
    return url;
  }

  try {
    const parsed = new URL(url);
    const route = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return route === "/" ? "/dashboard" : route;
  } catch {
    return url.startsWith("/") ? url : `/${url}`;
  }
};

export default function ClerkSignInScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { fetchStatus, signIn } = useSignIn() as unknown as {
    fetchStatus?: string;
    signIn?: {
      finalize: (input: {
        navigate: (input: {
          decorateUrl: (url: string) => string;
          session?: { currentTask?: { key?: string } | unknown };
        }) => void;
      }) => Promise<{
        error?: {
          longMessage?: string;
          message?: string;
        } | null;
      }>;
      password: (input: { emailAddress: string; password: string }) => Promise<{
        error?: {
          longMessage?: string;
          message?: string;
        };
      }>;
      status?: string;
    };
  };
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSubmitting = fetchStatus === "fetching";

  if (isLoaded && isSignedIn) {
    return <Redirect href={"/dashboard" as never} />;
  }

  const handleSignIn = async () => {
    const trimmedEmail = emailAddress.trim();

    if (!signIn || !trimmedEmail || !password || isSubmitting) {
      return;
    }

    setErrorMessage(null);

    try {
      const result = await signIn.password({
        emailAddress: trimmedEmail,
        password,
      });

      if (result.error) {
        setErrorMessage(
          getErrorMessage(
            result.error,
            "Clerk could not sign you in. Please check your details.",
          ),
        );
        return;
      }

      const finalized = await signIn.finalize({
        navigate({ decorateUrl, session }) {
          if (session?.currentTask) {
            setErrorMessage(
              "Finish the pending Clerk account task before opening WorkForcePro.",
            );
            return;
          }

          const nextRoute = normalizeDecoratedRoute(decorateUrl("/dashboard"));
          router.replace(nextRoute as never);
        },
      });

      if (finalized.error) {
        setErrorMessage(
          getErrorMessage(
            finalized.error,
            "Clerk could not complete sign-in on this device. Please try again.",
          ),
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Sign-in failed on this device. Please try again.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.logoWrap}>
              <Image source={workforceLogo} style={styles.logo} />
            </View>
            <Text style={styles.eyebrow}>Secure workforce access</Text>
            <Text style={styles.heading}>Sign in to WorkForcePro</Text>
            <Text style={styles.copy}>
              Use your Clerk account before accessing secure clocking, face
              scans, leave, and payroll tools.
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmailAddress}
                placeholder="name@company.com"
                placeholderTextColor="#6f879a"
                style={styles.input}
                textContentType="username"
                value={emailAddress}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#6f879a"
                secureTextEntry
                style={styles.input}
                textContentType="password"
                value={password}
              />

              {errorMessage ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              <Pressable
                disabled={isSubmitting || !emailAddress.trim() || !password}
                onPress={() => void handleSignIn()}
                style={[
                  styles.submitButton,
                  (isSubmitting || !emailAddress.trim() || !password) &&
                    styles.submitButtonDisabled,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitLabel}>Sign in with Clerk</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#dbeafe",
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  content: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 10,
  },
  copy: {
    color: "#475569",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  eyebrow: {
    color: "#087cc1",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 14,
    textTransform: "uppercase",
  },
  errorContainer: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
    lineHeight: 18,
  },
  flex: {
    flex: 1,
  },
  form: {
    gap: 8,
    marginTop: 20,
  },
  heading: {
    color: "#13264b",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 33,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#f8fbff",
    borderColor: "#bfdbfe",
    borderRadius: 14,
    borderWidth: 1,
    color: "#13264b",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  label: {
    color: "#13264b",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8,
  },
  logo: {
    height: 62,
    resizeMode: "contain",
    width: "100%",
  },
  logoWrap: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    justifyContent: "center",
  },
  screen: {
    backgroundColor: "#f4f8fc",
    flex: 1,
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: "#087cc1",
    borderRadius: 14,
    marginTop: 12,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});
