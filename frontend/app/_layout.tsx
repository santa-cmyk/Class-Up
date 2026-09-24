import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, LogBox, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { AuthProvider, useAuth } from "@/src/auth/AuthContext";
import { queryClient } from "@/src/query-client";
import { colors } from "@/src/theme";

LogBox.ignoreAllLogs(true);

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const first = segments[0] ?? "";
    const onLogin = first === "" || first === "index";
    const onOnboarding = first === "onboarding";

    if (!user) {
      if (!onLogin) router.replace("/");
      return;
    }
    const needsSetup = !user.profile_setup_completed || !user.initial_assessment_completed;
    if (needsSetup) {
      if (!onOnboarding) router.replace("/onboarding");
      return;
    }
    // Fully configured: keep out of /login and /onboarding only.
    if (onLogin || onOnboarding) {
      router.replace("/(tabs)");
    }
  }, [loading, user, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <AuthProvider>
              <AuthGate>
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />
              </AuthGate>
            </AuthProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
