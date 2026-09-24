import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { Icon, IconName } from "@/src/components/icon";
import { colors, radius, spacing } from "@/src/theme";

type Progress = { tasks_total: number; tasks_completed: number; tasks_pending: number; grades_avg: number; study_minutes: number };

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const progressQ = useQuery<Progress>({ queryKey: ["progress"], queryFn: () => api.get("/progress") });

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
          <View style={styles.avatarLg}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={{ width: 88, height: 88, borderRadius: 44 }} />
            ) : (
              <Text style={{ color: colors.onBrandPrimary, fontWeight: "800", fontSize: 32 }}>
                {user?.name?.[0] ?? "E"}
              </Text>
            )}
          </View>
          <Text style={styles.name}>{user?.name ?? "Estudiante"}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.gradePill}>
            <Text style={styles.gradePillText}>Grado {user?.grade ?? "9°"} · Colegio El Castillo</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Promedio" value={(progressQ.data?.grades_avg ?? 0).toFixed(1)} />
          <Stat label="Tareas hechas" value={`${progressQ.data?.tasks_completed ?? 0}`} />
          <Stat label="Minutos" value={`${progressQ.data?.study_minutes ?? 0}`} />
        </View>

        <Text style={styles.sectionTitle}>Actividad</Text>
        <Row icon="grades" title="Mis calificaciones" onPress={() => router.push("/grades")} testID="row-grades" />
        <Row icon="timer" title="Temporizador" onPress={() => router.push("/timer")} testID="row-timer" />
        <Row icon="resources" title="Recursos" onPress={() => router.push("/resources")} testID="row-resources" />

        <Text style={styles.sectionTitle}>Mis datos</Text>
        <View style={styles.infoCard} testID="profile-info-card">
          <InfoRow label="Sección" value={user?.section ? `9°${user.section}` : "—"} />
          <InfoRow label="Jornada" value={user?.jornada || "—"} />
          <InfoRow label="Fecha de nacimiento" value={user?.birth_date || "—"} />
          <InfoRow label="Teléfono" value={user?.student_phone || "—"} />
          <InfoRow label="Acudiente" value={user?.guardian_name || "—"} />
          <InfoRow label="Tel. acudiente" value={user?.guardian_phone || "—"} last />
        </View>
        <Row icon="profile" title="Editar mi perfil" onPress={() => router.push("/profile-edit")} testID="row-edit-profile" />

        <Text style={styles.sectionTitle}>Cuenta</Text>
        <Pressable onPress={signOut} style={[styles.row, { backgroundColor: colors.surfaceSecondary }]} testID="row-signout">
          <View style={[styles.rowIcon, { backgroundColor: "#FEE2E2" }]}>
            <Icon name="logout" size={18} color={colors.error} />
          </View>
          <Text style={[styles.rowTitle, { color: colors.error }]}>Cerrar sesión</Text>
        </Pressable>

        <Text style={styles.footer}>Class Up · El Castillo · v1</Text>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({
  icon, title, onPress, testID,
}: { icon: IconName; title: string; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} style={styles.row} testID={testID}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={18} color={colors.onBrandTertiary} />
      </View>
      <Text style={styles.rowTitle}>{title}</Text>
      <Icon name="chevron" size={22} color={colors.muted} />
    </Pressable>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: {
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.xl,
    alignItems: "center", gap: spacing.sm,
    borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg,
  },
  avatarLg: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
    borderWidth: 4, borderColor: colors.surface,
  },
  name: { color: colors.onSurface, fontSize: 22, fontWeight: "800", marginTop: spacing.xs },
  email: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  gradePill: {
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.pill, marginTop: spacing.sm,
  },
  gradePillText: { color: colors.onBrandTertiary, fontSize: 12, fontWeight: "700" },
  statsRow: { flexDirection: "row", padding: spacing.lg, gap: spacing.sm },
  stat: {
    flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border,
  },
  statValue: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 4 },
  sectionTitle: {
    paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm,
    color: colors.onSurfaceSecondary, fontWeight: "800", fontSize: 12,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  rowTitle: { flex: 1, color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  infoCard: {
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
  },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: spacing.md,
  },
  infoLabel: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  infoValue: { color: colors.onSurface, fontSize: 13, fontWeight: "700", flexShrink: 1, textAlign: "right" },
  footer: { textAlign: "center", color: colors.muted, fontSize: 11, marginTop: spacing.xl },
});
