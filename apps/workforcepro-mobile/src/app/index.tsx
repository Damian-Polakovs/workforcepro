import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";

function AuthLoadingScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#0d1b2a]">
      <View className="flex-1 items-center justify-center gap-4">
        <ActivityIndicator color="#ff764a" size="large" />
        <Text className="text-base text-white/80">
          Securing WorkForcePro with Clerk...
        </Text>
      </View>
    </SafeAreaView>
  );
}

export default function IndexScreen() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <AuthLoadingScreen />;
  }

  const nextRoute = (isSignedIn ? "/dashboard" : "/sign-in") as never;

  return <Redirect href={nextRoute} />;
}
