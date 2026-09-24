import { Image } from "expo-image";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth/AuthContext";
import { colors, radius, spacing } from "@/src/theme";

const LOGO = require("../assets/images/school-logo.jpg");

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, loading } = useAuth();

  return (
    <View style={styles.root} testID="login-screen">
      <View style={[styles.brandBar, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.brandDot} />
        <Text style={styles.brandBarText}>CLASS UP</Text>
      </View>

      <View style={styles.hero}>
        <Image source={LOGO} style={styles.logo} contentFit="contain" />
        <Text style={styles.institution}>Institución Educativa</Text>
        <Text style={styles.title}>COLEGIO EL CASTILLO</Text>
        <View style={styles.divider} />
        <Text style={styles.subtitle}>
          Organiza tus tareas, sigue tus calificaciones y aprovecha cada minuto de estudio.
        </Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Pressable
          testID="google-signin-button"
          onPress={signIn}
          disabled={loading}
          style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.85 }]}
        >
          {loading ? (
            <ActivityIndicator color={colors.onSurface} />
          ) : (
            <>
              <View style={styles.gLogo}>
                <Text style={styles.gLogoText}>G</Text>
              </View>
              <Text style={styles.googleBtnText}>Continuar con Google</Text>
            </>
          )}
        </Pressable>
        <Text style={styles.footer}>Cualquier cuenta de Google es válida.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  brandBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  brandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary },
  brandBarText: { fontSize: 12, fontWeight: "800", color: colors.onSurface, letterSpacing: 2 },

  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  logo: { width: 220, height: 220 },
  institution: {
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
    marginTop: spacing.md,
    textTransform: "uppercase",
  },
  title: {
    color: colors.onSurface,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 1,
    textAlign: "center",
  },
  divider: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.brandPrimary,
    marginVertical: spacing.md,
  },
  subtitle: {
    color: colors.onSurfaceSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
  },

  bottom: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  googleBtn: {
    backgroundColor: colors.onSurface,
    borderRadius: radius.pill,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  gLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  gLogoText: { color: "#EA4335", fontWeight: "900", fontSize: 14 },
  googleBtnText: { color: colors.surface, fontSize: 16, fontWeight: "700" },
  footer: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});
