import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { Icon } from "@/src/components/icon";
import { SubjectIcon } from "@/src/components/subject-icon";
import { colors, radius, spacing, subjectColor } from "@/src/theme";

type Task = {
  id: string; title: string; subject: string; due_date?: string; due_time?: string;
  priority: string; completed: boolean;
};
type Progress = { tasks_total: number; tasks_completed: number; tasks_pending: number; grades_avg: number; study_minutes: number };
type Grade = { id: string; subject: string; activity: string; score: number };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function dueSoon(task: Task): { dueMs: number; hoursLeft: number } | null {
  if (task.completed || !task.due_date) return null;
  // Combine date + optional time into a local Date
  const iso = task.due_time ? `${task.due_date}T${task.due_time.length === 5 ? task.due_time : task.due_time}:00` : `${task.due_date}T23:59:00`;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  const now = Date.now();
  const diff = t - now;
  const hoursLeft = diff / (1000 * 60 * 60);
  // Show if due within 24h AND not more than 12h overdue
  if (hoursLeft > 24 || hoursLeft < -12) return null;
  return { dueMs: t, hoursLeft };
}

function formatDueLabel(hoursLeft: number) {
  if (hoursLeft < 0) return "atrasada";
  if (hoursLeft < 1) return "en menos de 1 h";
  const h = Math.round(hoursLeft);
  return `en ${h} h`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const tasksQ = useQuery<Task[]>({ queryKey: ["tasks"], queryFn: () => api.get("/tasks") });
  const progressQ = useQuery<Progress>({ queryKey: ["progress"], queryFn: () => api.get("/progress") });
  const gradesQ = useQuery<Grade[]>({ queryKey: ["grades"], queryFn: () => api.get("/grades") });

  const upcoming = (tasksQ.data ?? []).filter((t) => !t.completed).slice(0, 5);
  const dueSoonTasks = (tasksQ.data ?? [])
    .map((t) => ({ task: t, meta: dueSoon(t) }))
    .filter((x): x is { task: Task; meta: { dueMs: number; hoursLeft: number } } => !!x.meta)
    .sort((a, b) => a.meta.dueMs - b.meta.dueMs);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: spacing["2xl"],
        }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greet}>{greeting()},</Text>
            <Text style={styles.name} numberOfLines={1}>
              {user?.name ?? "Estudiante"}
            </Text>
            <Text style={styles.gradeText}>Grado {user?.grade ?? "9°"}{user?.section ? ` · ${user.section}` : ""}</Text>
          </View>
          <View style={styles.avatar}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={{ width: 52, height: 52, borderRadius: 26 }} />
            ) : (
              <Text style={styles.avatarText}>{user?.name?.[0] ?? "E"}</Text>
            )}
          </View>
        </View>

        {/* Aviso de entregas < 24h */}
        {dueSoonTasks.length > 0 ? (
          <View style={styles.alertWrap} testID="due-soon-banner">
            {dueSoonTasks.slice(0, 3).map(({ task, meta }) => {
              const overdue = meta.hoursLeft < 0;
              return (
                <Pressable
                  key={task.id}
                  onPress={() => router.push("/(tabs)/tasks")}
                  style={[styles.alertCard, overdue ? styles.alertCardOverdue : styles.alertCardWarn]}
                  testID={`due-soon-${task.id}`}
                >
                  <View style={styles.alertIcon}>
                    <Text style={styles.alertIconText}>{overdue ? "!" : "◔"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertTitle} numberOfLines={1}>
                      {overdue ? "Entrega atrasada" : "Entrega próxima"} · {task.subject}
                    </Text>
                    <Text style={styles.alertSub} numberOfLines={1}>
                      {task.title} · vence {formatDueLabel(meta.hoursLeft)}
                    </Text>
                  </View>
                  <Text style={styles.alertLink}>Ver ›</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {/* Rendimiento */}
        <View style={styles.metricsRow}>
          <View style={[styles.metric, { backgroundColor: colors.brandPrimary }]}>
            <Text style={[styles.metricLabel, { color: "rgba(255,255,255,0.85)" }]}>Promedio</Text>
            <Text style={[styles.metricValue, { color: colors.onBrandPrimary }]}>
              {(progressQ.data?.grades_avg ?? 0).toFixed(1)}
            </Text>
          </View>
          <View style={[styles.metric, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={styles.metricLabel}>Tareas</Text>
            <Text style={styles.metricValue}>
              {progressQ.data?.tasks_completed ?? 0}
              <Text style={styles.metricSub}> / {progressQ.data?.tasks_total ?? 0}</Text>
            </Text>
          </View>
          <View style={[styles.metric, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={styles.metricLabel}>Estudio</Text>
            <Text style={styles.metricValue}>
              {progressQ.data?.study_minutes ?? 0}
              <Text style={styles.metricSub}> min</Text>
            </Text>
          </View>
        </View>

        {/* Accesos rápidos */}
        <Text style={styles.sectionTitle}>Accesos rápidos</Text>
        <View style={styles.quickGrid}>
          <QuickTile
            testID="quick-grades"
            title="Calificaciones"
            icon="grades"
            onPress={() => router.push("/grades")}
          />
          <QuickTile
            testID="quick-timer"
            title="Temporizador"
            icon="timer"
            onPress={() => router.push("/timer")}
          />
          <QuickTile
            testID="quick-resources"
            title="Recursos"
            icon="resources"
            onPress={() => router.push("/resources")}
          />
        </View>

        {/* Próximas entregas */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Próximas entregas</Text>
          <Pressable onPress={() => router.push("/(tabs)/tasks")}>
            <Text style={styles.link}>Ver todo</Text>
          </Pressable>
        </View>
        {upcoming.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin tareas pendientes</Text>
            <Text style={styles.emptySub}>Añade tu primera tarea desde la pestaña Tareas.</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {upcoming.map((t) => {
              const c = subjectColor(t.subject);
              return (
                <Pressable
                  key={t.id}
                  onPress={() => router.push("/(tabs)/tasks")}
                  style={styles.taskRow}
                  testID={`home-task-${t.id}`}
                >
                  <SubjectIcon name={t.subject} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taskTitle} numberOfLines={1}>{t.title}</Text>
                    <Text style={styles.taskSub}>
                      {t.subject} {t.due_date ? `· ${t.due_date}` : ""}
                    </Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: c.bg }]}>
                    <Text style={[styles.pillText, { color: c.fg }]}>{t.priority}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Últimas calificaciones */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Últimas calificaciones</Text>
          <Pressable onPress={() => router.push("/grades")}>
            <Text style={styles.link}>Ver todo</Text>
          </Pressable>
        </View>
        {(gradesQ.data ?? []).length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Aún sin calificaciones</Text>
            <Text style={styles.emptySub}>Regístralas desde Calificaciones.</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {(gradesQ.data ?? []).slice(0, 4).map((g) => (
              <View key={g.id} style={styles.gradeRow}>
                <SubjectIcon name={g.subject} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.taskTitle} numberOfLines={1}>{g.activity}</Text>
                  <Text style={styles.taskSub}>{g.subject}</Text>
                </View>
                <Text style={styles.scoreBig}>{g.score.toFixed(1)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function QuickTile({
  title, icon, onPress, testID,
}: { title: string; icon: any; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} style={styles.quickTile} testID={testID}>
      <View style={styles.quickIcon}>
        <Icon name={icon} size={22} color={colors.onBrandTertiary} />
      </View>
      <Text style={styles.quickText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  greet: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  name: { color: colors.onSurface, fontSize: 24, fontWeight: "800", marginTop: 2 },
  gradeText: { color: colors.muted, fontSize: 12, marginTop: 2 },
  avatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarText: { color: colors.onBrandPrimary, fontSize: 22, fontWeight: "800" },
  alertWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm },
  alertCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, borderRadius: radius.lg, borderWidth: 1,
  },
  alertCardWarn: { backgroundColor: "#FEF3C7", borderColor: "#FCD34D" },
  alertCardOverdue: { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" },
  alertIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center", justifyContent: "center",
  },
  alertIconText: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  alertTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800" },
  alertSub: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  alertLink: { color: colors.onSurface, fontSize: 13, fontWeight: "800" },
  metricsRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  metric: {
    flex: 1, borderRadius: radius.lg, padding: spacing.md, gap: 4,
  },
  metricLabel: { fontSize: 11, color: colors.muted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  metricValue: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  metricSub: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  sectionTitle: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md, marginBottom: spacing.sm,
    fontSize: 16, fontWeight: "800", color: colors.onSurface,
  },
  sectionHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingRight: spacing.lg,
  },
  link: { color: colors.brandPrimary, fontWeight: "700", fontSize: 13 },
  quickGrid: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  quickTile: {
    flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    padding: spacing.md, alignItems: "flex-start", gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  quickIcon: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  quickText: { color: colors.onSurface, fontWeight: "700", fontSize: 13 },
  emptyCard: {
    marginHorizontal: spacing.lg, backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  emptyTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  emptySub: { color: colors.muted, fontSize: 13, marginTop: 4 },
  taskRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  taskTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  taskSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  gradeRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  scoreBig: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
});
