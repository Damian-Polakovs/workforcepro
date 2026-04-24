import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSignIn } from "@clerk/expo";
import { useRouter } from "expo-router";

export default function ClerkSignInScreen() {
  const router = useRouter();
  const { fetchStatus, signIn } = useSignIn() as unknown as {
    fetchStatus?: string;
    signIn?: {
      finalize: (input: {
        navigate: (input: {
          decorateUrl: (url: string) => string;
          session?: { currentTask?: unknown };
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

  const handleSignIn = async () => {
    if (!signIn || !emailAddress || !password || isSubmitting) {
      return;
    }

    setErrorMessage(null);

    const result = await signIn.password({
      emailAddress,
      password,
    });

    if (result.error) {
      setErrorMessage(
        result.error.longMessage ??
          result.error.message ??
          "Clerk could not sign you in. Please check your details.",
      );
      return;
    }

    if (signIn.status !== "complete") {
      setErrorMessage(
        "This account needs an additional Clerk verification step before it can open WorkForcePro.",
      );
      return;
    }

    await signIn.finalize({
      navigate({ decorateUrl, session }) {
        if (session?.currentTask) {
          setErrorMessage(
            "Finish the pending Clerk account task before opening WorkForcePro.",
          );
          return;
        }

        const nextUrl = decorateUrl("/dashboard");
      router.replace(
        (nextUrl.startsWith("http") ? "/dashboard" : nextUrl) as never,
      );
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0d1b2a]">
      <View className="absolute left-[-72] top-[-24] h-56 w-56 rounded-full bg-[#ff764a]/25" />
      <View className="absolute right-[-60] top-36 h-64 w-64 rounded-full bg-[#4ecdc4]/12" />
      <View className="flex-1 justify-center px-6">
        <View className="rounded-[34px] border border-white/12 bg-[#10253a] p-6">
          <Text className="text-xs uppercase tracking-[3px] text-[#9fb4c8]">
            Clerk authentication
          </Text>
          <Text className="mt-4 text-4xl font-semibold leading-[46px] text-white">
            Sign in to WorkForcePro
          </Text>
          <Text className="mt-3 text-base leading-7 text-[#bed0dd]">
            Use your Clerk account before accessing secure clocking, face scans,
            leave, and payroll tools.
          </Text>

          <View className="mt-6 gap-3">
            <TextInput
              autoCapitalize="none"
              className="rounded-2xl border border-white/12 bg-[#0f1f2f] px-4 py-3 text-white"
              keyboardType="email-address"
              onChangeText={setEmailAddress}
              placeholder="Email address"
              placeholderTextColor="#6f879a"
              value={emailAddress}
            />
            <TextInput
              className="rounded-2xl border border-white/12 bg-[#0f1f2f] px-4 py-3 text-white"
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#6f879a"
              secureTextEntry
              value={password}
            />

            {errorMessage ? (
              <Text className="rounded-2xl border border-[#ff764a]/30 bg-[#ff764a]/10 px-4 py-3 text-sm leading-6 text-[#ffd0c3]">
                {errorMessage}
              </Text>
            ) : null}

            <Pressable
              className={`rounded-2xl bg-[#ff764a] px-4 py-4 ${
                isSubmitting || !emailAddress || !password ? "opacity-50" : ""
              }`}
              disabled={isSubmitting || !emailAddress || !password}
              onPress={() => void handleSignIn()}
            >
              <Text className="text-center text-sm font-semibold text-white">
                {isSubmitting ? "Signing in..." : "Sign in with Clerk"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
