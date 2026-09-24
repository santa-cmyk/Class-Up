import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Icon } from "@/src/components/icon";
import { SubjectIcon } from "@/src/components/subject-icon";
import { colors, radius, spacing, subjectColor } from "@/src/theme";

type Task = {
  id: string; title: string; description?: string; subject: string;
  due_date?: string; due_time?: string; priority: string; completed: boolean;
};

const SUBJECTS = ["Lectura Crítica", "Matemáticas", "Sociales y Ciudadanas", "Ciencias Naturales", "Inglés", "Otra"];
const PRIORITIES = ["alta", "media", "baja"] as const;
const FILTERS = ["Todas", "Pendientes", "Completadas"] as const;

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Todas");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks"], queryFn: () => api.get("/tasks"),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["progress"] });
  };

  const toggleMut = useMutation({
    mutationFn: (t: Task) => api.patch(`/tasks/${t.id}`, { completed: !t.completed }),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/tasks/${id}`),
    onSuccess: invalidate,
  });

  const filtered = tasks.filter((t) =>
    filter === "Todas" ? true : filter === "Pendientes" ? !t.completed : t.completed,
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Mis tareas</Text>
        <Text style={styles.subtitle}>{tasks.filter((t) => !t.completed).length} pendientes</Text>
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.md }}
          style={{ marginHorizontal: -spacing.lg }}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f} onPress={() => setFilter(f)}
              style={[styles.chip, filter === f && styles.chipActive]}
              testID={`filter-${f}`}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.brandPrimary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.sm }}>
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Aún no tienes tareas</Text>
              <Text style={styles.emptySub}>Toca el botón + para crear tu primera tarea.</Text>
            </View>
          ) : (
            filtered.map((t) => {
              const c = subjectColor(t.subject);
              return (
                <View key={t.id} style={styles.taskRow} testID={`task-${t.id}`}>
                  <Pressable
                    onPress={() => toggleMut.mutate(t)}
                    style={[styles.check, t.completed && { backgroundColor: colors.success, borderColor: colors.success }]}
                    testID={`task-check-${t.id}`}
                  >
                    {t.completed && <Icon name="check" size={14} color={colors.onSuccess} />}
                  </Pressable>
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => { setEditing(t); setModalOpen(true); }}
                  >
                    <Text style={[styles.taskTitle, t.completed && { textDecorationLine: "line-through", color: colors.muted }]} numberOfLines={2}>
                      {t.title}
                    </Text>
                    <View style={styles.taskMetaRow}>
                      <View style={[styles.badge, { backgroundColor: c.bg }]}>
                        <Text style={[styles.badgeText, { color: c.fg }]}>{t.subject}</Text>
                      </View>
                      {t.due_date ? (
                        <Text style={styles.taskMeta}>· {t.due_date}{t.due_time ? ` ${t.due_time}` : ""}</Text>
                      ) : null}
                      <View style={[styles.prio, prioStyle(t.priority)]}>
                        <Text style={styles.prioText}>{t.priority}</Text>
                      </View>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => deleteMut.mutate(t.id)} testID={`task-delete-${t.id}`} hitSlop={10}>
                    <Icon name="trash" size={18} color={colors.error} />
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <Pressable
        onPress={() => { setEditing(null); setModalOpen(true); }}
        style={[styles.fab, { bottom: spacing.lg + 60 + insets.bottom }]}
        testID="task-fab-add"
      >
        <Icon name="plus" size={22} color={colors.onBrandPrimary} weight="800" />
      </Pressable>

      <TaskFormModal
        visible={modalOpen}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSaved={invalidate}
      />
    </View>
  );
}

function prioStyle(p: string) {
  if (p === "alta") return { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" };
  if (p === "media") return { backgroundColor: "#FEF3C7", borderColor: "#FCD34D" };
  return { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" };
}

function TaskFormModal({
  visible, initial, onClose, onSaved,
}: {
  visible: boolean; initial: Task | null; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? SUBJECTS[0]);
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [dueTime, setDueTime] = useState(initial?.due_time ?? "");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>((initial?.priority as any) ?? "media");
  const [description, setDescription] = useState(initial?.description ?? "");

  // reset on open
  useState(() => { /* noop for first mount */ });

  // Re-init whenever the modal is (re)opened with a different initial
  useUpdateEffect(() => {
    setTitle(initial?.title ?? "");
    setSubject(initial?.subject ?? SUBJECTS[0]);
    setDueDate(initial?.due_date ?? "");
    setDueTime(initial?.due_time ?? "");
    setPriority((initial?.priority as any) ?? "media");
    setDescription(initial?.description ?? "");
  }, [visible, initial?.id]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = { title, subject, due_date: dueDate || null, due_time: dueTime || null, priority, description };
      if (initial) return api.patch(`/tasks/${initial.id}`, body);
      return api.post("/tasks", body);
    },
    onSuccess: () => { onSaved(); onClose(); },
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
          <View style={styles.modalCard}>
            <View style={styles.modalGrabber} />
            <Text style={styles.modalTitle}>{initial ? "Editar tarea" : "Nueva tarea"}</Text>

            <Text style={styles.label}>Título</Text>
            <TextInput
              testID="form-title" value={title} onChangeText={setTitle}
              placeholder="Ej. Leer capítulo 3"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />

            <Text style={styles.label}>Materia</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {SUBJECTS.map((s) => (
                <Pressable
                  key={s} onPress={() => setSubject(s)}
                  style={[styles.chipSm, subject === s && styles.chipSmActive]}
                >
                  <Text style={[styles.chipTextSm, subject === s && { color: colors.onBrandPrimary }]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Fecha</Text>
                <TextInput
                  testID="form-date" value={dueDate} onChangeText={setDueDate}
                  placeholder="AAAA-MM-DD" placeholderTextColor={colors.muted} style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Hora</Text>
                <TextInput
                  testID="form-time" value={dueTime} onChangeText={setDueTime}
                  placeholder="HH:MM" placeholderTextColor={colors.muted} style={styles.input}
                />
              </View>
            </View>

            <Text style={styles.label}>Prioridad</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {PRIORITIES.map((p) => (
                <Pressable key={p} onPress={() => setPriority(p)} style={[styles.chipSm, priority === p && styles.chipSmActive]}>
                  <Text style={[styles.chipTextSm, priority === p && { color: colors.onBrandPrimary }]}>{p}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Descripción</Text>
            <TextInput
              testID="form-description" value={description} onChangeText={setDescription} multiline
              placeholder="Detalles opcionales" placeholderTextColor={colors.muted}
              style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
            />

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: colors.surfaceSecondary, flex: 1 }]}>
                <Text style={{ color: colors.onSurface, fontWeight: "700" }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => title.trim() && saveMut.mutate()}
                disabled={saveMut.isPending}
                style={[styles.btn, { backgroundColor: colors.brandPrimary, flex: 1 }]}
                testID="task-save"
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

// Tiny helper: runs the effect after mount only when deps change.
import { useEffect, useRef } from "react";
function useUpdateEffect(cb: () => void, deps: any[]) {
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    cb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 4 },
  chip: {
    paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
    flexShrink: 0, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.onSurface, borderColor: colors.onSurface },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
  chipTextActive: { color: colors.surface },
  taskRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  check: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.surface,
  },
  taskTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  taskMetaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 6, flexWrap: "wrap" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: "700" },
  taskMeta: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  prio: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1 },
  prioText: { fontSize: 11, fontWeight: "700", color: colors.onSurface, textTransform: "capitalize" },
  empty: { padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  emptyTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  emptySub: { color: colors.muted, fontSize: 13, textAlign: "center" },
  fab: {
    position: "absolute", right: spacing.lg, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowOffset: { width: 0, height: 6 }, shadowRadius: 12, elevation: 6,
  },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl,
  },
  modalGrabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 4, backgroundColor: colors.border, marginBottom: spacing.md },
  modalTitle: { fontSize: 20, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.sm },
  label: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700", marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.md, padding: 12, color: colors.onSurface, fontSize: 15, marginTop: 4,
  },
  chipSm: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    marginTop: 4, flexShrink: 0,
  },
  chipSmActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipTextSm: { fontSize: 13, fontWeight: "700", color: colors.onSurface, textTransform: "capitalize" },
  btn: { paddingVertical: 14, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
