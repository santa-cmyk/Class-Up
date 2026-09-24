import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Icon } from "@/src/components/icon";
import { SubjectIcon } from "@/src/components/subject-icon";
import { colors, radius, spacing, subjectColor } from "@/src/theme";

type Grade = { id: string; subject: string; activity: string; period: string; score: number };
type Summary = { overall: number; per_subject: { subject: string; average: number; count: number }[]; total_entries: number };

const SUBJECTS = ["Lectura Crítica", "Matemáticas", "Sociales", "Ciencias Naturales", "Inglés", "Otra"];
const PERIODS = ["P1", "P2", "P3", "P4"];

export default function GradesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const gradesQ = useQuery<Grade[]>({ queryKey: ["grades"], queryFn: () => api.get("/grades") });
  const summaryQ = useQuery<Summary>({ queryKey: ["grades-summary"], queryFn: () => api.get("/grades/summary") });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/grades/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grades"] });
      qc.invalidateQueries({ queryKey: ["grades-summary"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
    },
  });

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} testID="back" hitSlop={10}>
            <Text style={styles.back}>‹ Volver</Text>
          </Pressable>
          <Pressable onPress={() => setOpen(true)} style={styles.addBtn} testID="grades-add">
            <Icon name="plus" size={16} color={colors.onBrandPrimary} weight="800" />
            <Text style={styles.addBtnText}>Añadir</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Mis calificaciones</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 100 }}>
        <View style={styles.overallCard}>
          <Text style={styles.overallLabel}>Promedio general</Text>
          <Text style={styles.overallValue}>{(summaryQ.data?.overall ?? 0).toFixed(1)}</Text>
          <Text style={styles.overallSub}>{summaryQ.data?.total_entries ?? 0} calificaciones registradas</Text>
        </View>

        <Text style={styles.section}>Por materia</Text>
        {(summaryQ.data?.per_subject ?? []).length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptySub}>No hay calificaciones registradas.</Text>
          </View>
        ) : (
          summaryQ.data!.per_subject.map((s) => {
            const c = subjectColor(s.subject);
            const pct = Math.min(1, s.average / 5);
            return (
              <View key={s.subject} style={styles.subjectCard}>
                <SubjectIcon name={s.subject} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.subjectName}>{s.subject}</Text>
                  <Text style={styles.subjectMeta}>{s.count} actividades</Text>
                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: c.solid }]} />
                  </View>
                </View>
                <Text style={styles.subjectAvg}>{s.average.toFixed(1)}</Text>
              </View>
            );
          })
        )}

        <Text style={styles.section}>Historial</Text>
        {(gradesQ.data ?? []).length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptySub}>Sin registros aún.</Text></View>
        ) : (
          (gradesQ.data ?? []).map((g) => {
            const c = subjectColor(g.subject);
            return (
              <View key={g.id} style={styles.row}>
                <SubjectIcon name={g.subject} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{g.activity}</Text>
                  <Text style={styles.rowSub}>{g.subject} · {g.period}</Text>
                </View>
                <View style={[styles.scoreBadge, { backgroundColor: c.bg }]}>
                  <Text style={[styles.scoreBadgeText, { color: c.fg }]}>{g.score.toFixed(1)}</Text>
                </View>
                <Pressable onPress={() => deleteMut.mutate(g.id)} hitSlop={10} testID={`grade-del-${g.id}`}>
                  <Icon name="trash" size={18} color={colors.error} />
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      <GradeForm visible={open} onClose={() => setOpen(false)} onSaved={() => {
        qc.invalidateQueries({ queryKey: ["grades"] });
        qc.invalidateQueries({ queryKey: ["grades-summary"] });
        qc.invalidateQueries({ queryKey: ["progress"] });
      }} />
    </View>
  );
}

function GradeForm({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [activity, setActivity] = useState("");
  const [period, setPeriod] = useState("P1");
  const [score, setScore] = useState("");

  const saveMut = useMutation({
    mutationFn: () =>
      api.post("/grades", { subject, activity, period, score: parseFloat(score || "0") }),
    onSuccess: () => {
      setActivity(""); setScore("");
      onSaved(); onClose();
    },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
          <View style={styles.modalCard}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>Nueva calificación</Text>

            <Text style={styles.label}>Actividad</Text>
            <TextInput
              testID="grade-activity" value={activity} onChangeText={setActivity}
              placeholder="Ej. Quiz de álgebra" placeholderTextColor={colors.muted} style={styles.input}
            />

            <Text style={styles.label}>Materia</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {SUBJECTS.map((s) => (
                <Pressable key={s} onPress={() => setSubject(s)} style={[styles.chipSm, subject === s && styles.chipSmActive]}>
                  <Text style={[styles.chipTextSm, subject === s && { color: colors.onBrandPrimary }]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Periodo</Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {PERIODS.map((p) => (
                    <Pressable key={p} onPress={() => setPeriod(p)} style={[styles.chipSm, period === p && styles.chipSmActive]}>
                      <Text style={[styles.chipTextSm, period === p && { color: colors.onBrandPrimary }]}>{p}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={{ width: 120 }}>
                <Text style={styles.label}>Nota (0–5)</Text>
                <TextInput
                  testID="grade-score" value={score} onChangeText={setScore}
                  keyboardType="decimal-pad" placeholder="4.5"
                  placeholderTextColor={colors.muted} style={styles.input}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
              <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: colors.surfaceSecondary, flex: 1 }]}>
                <Text style={{ color: colors.onSurface, fontWeight: "700" }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => activity.trim() && score.trim() && saveMut.mutate()}
                style={[styles.btn, { backgroundColor: colors.brandPrimary, flex: 1 }]}
                testID="grade-save"
              >
                <Text style={{ color: colors.onBrandPrimary, fontWeight: "800" }}>
                  {saveMut.isPending ? "Guardando..." : "Guardar"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  back: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.brandPrimary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill,
  },
  addBtnText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 13 },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface, marginTop: spacing.sm },
  overallCard: {
    backgroundColor: colors.brandPrimary, borderRadius: radius.lg, padding: spacing.lg, gap: 6,
  },
  overallLabel: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  overallValue: { color: colors.onBrandPrimary, fontSize: 44, fontWeight: "800", letterSpacing: -1 },
  overallSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },
  section: { color: colors.onSurface, fontWeight: "800", fontSize: 15, marginTop: spacing.md },
  subjectCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  subjectName: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  subjectMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  bar: { height: 6, backgroundColor: colors.surfaceTertiary, borderRadius: 3, marginTop: 8, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  subjectAvg: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  rowTitle: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  rowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  scoreBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  scoreBadgeText: { fontWeight: "800", fontSize: 14 },
  empty: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  emptySub: { color: colors.muted, fontSize: 13 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: spacing.lg, paddingBottom: spacing.xl,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 4, backgroundColor: colors.border, marginBottom: spacing.md },
  modalTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800", marginBottom: spacing.sm },
  label: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700", marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.md, padding: 12, color: colors.onSurface, fontSize: 15, marginTop: 4,
  },
  chipSm: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginTop: 4, flexShrink: 0,
  },
  chipSmActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipTextSm: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
  btn: { paddingVertical: 14, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
