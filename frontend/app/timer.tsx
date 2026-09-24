import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

const OPTIONS = [15, 25, 45, 60] as const;

type SessionEntry = { id: string; duration_min: number; created_at: string; subject?: string };

function fmt(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function TimerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [duration, setDuration] = useState<number>(25);
  const [remaining, setRemaining] = useState<number>(25 * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<any>(null);

  const sessQ = useQuery<SessionEntry[]>({ queryKey: ["sessions"], queryFn: () => api.get("/sessions") });
  const summaryQ = useQuery<{ total_sessions: number; total_minutes: number }>({
    queryKey: ["sessions-summary"], queryFn: () => api.get("/sessions/summary"),
  });

  const saveMut = useMutation({
    mutationFn: (mins: number) => api.post("/sessions", { duration_min: mins, completed: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["sessions-summary"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
    },
  });

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current);
          setRunning(false);
          saveMut.mutate(duration);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const setOption = (mins: number) => {
    setRunning(false);
    setDuration(mins);
    setRemaining(mins * 60);
  };

  const reset = () => { setRunning(false); setRemaining(duration * 60); };

  const progress = 1 - remaining / (duration * 60);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} testID="timer-back" hitSlop={10}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>Temporizador</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.circleWrap}>
        <View style={styles.circleBg}>
          <View style={[styles.circleFill, { transform: [{ rotate: `${progress * 360}deg` }] }]} />
          <View style={styles.circleInner}>
            <Text style={styles.time}>{fmt(remaining)}</Text>
            <Text style={styles.timeSub}>{duration} min de enfoque</Text>
          </View>
        </View>
      </View>

      <View style={styles.optionsRow}>
        {OPTIONS.map((o) => (
          <Pressable
            key={o} onPress={() => setOption(o)}
            style={[styles.option, duration === o && styles.optionActive]}
            testID={`timer-option-${o}`}
          >
            <Text style={[styles.optionText, duration === o && { color: colors.onBrandPrimary }]}>{o} min</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.controlsRow}>
        <Pressable
          onPress={() => setRunning((r) => !r)}
          style={[styles.mainBtn, { backgroundColor: running ? colors.warning : colors.brandPrimary }]}
          testID="timer-toggle"
        >
          <Text style={styles.mainBtnText}>{running ? "Pausar" : "Iniciar"}</Text>
        </Pressable>
        <Pressable onPress={reset} style={styles.secondaryBtn} testID="timer-reset">
          <Text style={styles.secondaryBtnText}>Reiniciar</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 60 }}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summaryQ.data?.total_sessions ?? 0}</Text>
            <Text style={styles.summaryLabel}>Sesiones</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summaryQ.data?.total_minutes ?? 0}</Text>
            <Text style={styles.summaryLabel}>Minutos totales</Text>
          </View>
        </View>

        <Text style={styles.historyTitle}>Historial reciente</Text>
        {(sessQ.data ?? []).length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptySub}>Sin sesiones registradas todavía.</Text></View>
        ) : (
          (sessQ.data ?? []).slice(0, 10).map((s) => (
            <View key={s.id} style={styles.histRow}>
              <View style={styles.dot} />
              <Text style={styles.histTitle}>{s.duration_min} min</Text>
              <Text style={styles.histSub}>{new Date(s.created_at).toLocaleString()}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const CIRCLE = 240;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerRow: {
    paddingHorizontal: spacing.lg, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md,
  },
  back: { color: colors.muted, fontSize: 14, fontWeight: "700", width: 60 },
  title: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  circleWrap: { alignItems: "center", paddingVertical: spacing.lg },
  circleBg: {
    width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2,
    backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  circleFill: {
    position: "absolute", width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2,
    borderWidth: 10, borderColor: colors.brandPrimary, borderRightColor: "transparent", borderBottomColor: "transparent",
  },
  circleInner: {
    width: CIRCLE - 30, height: CIRCLE - 30, borderRadius: (CIRCLE - 30) / 2,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  time: { fontSize: 52, fontWeight: "800", color: colors.onSurface, letterSpacing: -1 },
  timeSub: { color: colors.muted, fontSize: 12, marginTop: 4, fontWeight: "600" },
  optionsRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  option: {
    flex: 1, paddingVertical: 12, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    alignItems: "center",
  },
  optionActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  optionText: { color: colors.onSurface, fontWeight: "700", fontSize: 13 },
  controlsRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  mainBtn: { flex: 2, paddingVertical: 16, borderRadius: radius.pill, alignItems: "center" },
  mainBtnText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 16 },
  secondaryBtn: {
    flex: 1, paddingVertical: 16, borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center",
  },
  secondaryBtnText: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  summaryRow: { flexDirection: "row", gap: spacing.sm },
  summaryCard: {
    flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.border,
  },
  summaryValue: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  summaryLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 4 },
  historyTitle: { color: colors.onSurface, fontWeight: "800", fontSize: 15, marginTop: spacing.md, marginBottom: spacing.xs },
  histRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary },
  histTitle: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  histSub: { color: colors.muted, fontSize: 12, marginLeft: "auto" },
  empty: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  emptySub: { color: colors.muted, fontSize: 13 },
});
