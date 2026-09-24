import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { SubjectIcon } from "@/src/components/subject-icon";
import { colors, radius, spacing, subjectColor } from "@/src/theme";

type Task = { id: string; title: string; subject: string; due_date?: string; completed: boolean };
type SessionEntry = { id: string; duration_min: number; subject?: string; created_at: string };
type EventDoc = { id: string; title: string; date: string; time?: string; type: string; subject?: string; description?: string };

const DAYS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string>(ymd(new Date()));

  const tasksQ = useQuery<Task[]>({ queryKey: ["tasks"], queryFn: () => api.get("/tasks") });
  const sessQ = useQuery<SessionEntry[]>({ queryKey: ["sessions"], queryFn: () => api.get("/sessions") });
  const eventsQ = useQuery<EventDoc[]>({ queryKey: ["events"], queryFn: () => api.get("/events") });

  const eventsByDate = useMemo(() => {
    const map: Record<string, { tasks: Task[]; sessions: SessionEntry[]; events: EventDoc[] }> = {};
    (tasksQ.data ?? []).forEach((t) => {
      if (!t.due_date) return;
      const k = t.due_date;
      (map[k] ??= { tasks: [], sessions: [], events: [] }).tasks.push(t);
    });
    (sessQ.data ?? []).forEach((s) => {
      const k = s.created_at.slice(0, 10);
      (map[k] ??= { tasks: [], sessions: [], events: [] }).sessions.push(s);
    });
    (eventsQ.data ?? []).forEach((e) => {
      const k = e.date;
      (map[k] ??= { tasks: [], sessions: [], events: [] }).events.push(e);
    });
    return map;
  }, [tasksQ.data, sessQ.data, eventsQ.data]);

  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const changeMonth = (delta: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  const selectedEvents = eventsByDate[selected] ?? { tasks: [], sessions: [], events: [] };
  const today = ymd(new Date());

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Calendario</Text>
        <View style={styles.monthRow}>
          <Pressable onPress={() => changeMonth(-1)} style={styles.navBtn} testID="calendar-prev">
            <Text style={styles.navText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </Text>
          <Pressable onPress={() => changeMonth(1)} style={styles.navBtn} testID="calendar-next">
            <Text style={styles.navText}>›</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            {DAYS.map((d) => (
              <Text key={d} style={styles.dayLabel}>{d}</Text>
            ))}
          </View>
          {chunk(monthDays, 7).map((row, ri) => (
            <View key={ri} style={styles.gridRow}>
              {row.map((cell, ci) => {
                const key = cell ? ymd(cell) : `empty-${ri}-${ci}`;
                if (!cell) return <View key={key} style={styles.cell} />;
                const isSelected = ymd(cell) === selected;
                const isToday = ymd(cell) === today;
                const has = !!eventsByDate[ymd(cell)];
                return (
                  <Pressable key={key} onPress={() => setSelected(ymd(cell))} style={styles.cell} testID={`calendar-day-${ymd(cell)}`}>
                    <View style={[styles.dayPill, isSelected && styles.dayPillActive, !isSelected && isToday && styles.dayPillToday]}>
                      <Text style={[styles.dayText, (isSelected || isToday) && { fontWeight: "800" }, isSelected && { color: colors.onBrandPrimary }]}>
                        {cell.getDate()}
                      </Text>
                    </View>
                    {has ? <View style={[styles.dot, isSelected && { backgroundColor: colors.onBrandPrimary }]} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Text style={styles.sectionTitle}>Eventos del {selected}</Text>
          {selectedEvents.tasks.length === 0 && selectedEvents.sessions.length === 0 && selectedEvents.events.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptySub}>Sin eventos programados.</Text>
            </View>
          ) : (
            <>
              {selectedEvents.events.map((e) => {
                const c = e.subject ? subjectColor(e.subject) : { bg: colors.brandTertiary, fg: colors.onBrandTertiary, solid: colors.brandPrimary };
                return (
                  <View key={e.id} style={styles.card} testID={`event-${e.id}`}>
                    <View style={[styles.sessionIcon, { backgroundColor: c.bg }]}>
                      <Text style={{ color: c.fg, fontWeight: "800" }}>◱</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{e.title}</Text>
                      <Text style={styles.cardSub}>
                        {e.type} {e.time ? `· ${e.time}` : ""}{e.subject ? ` · ${e.subject}` : ""}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {selectedEvents.tasks.map((t) => {
                const c = subjectColor(t.subject);
                return (
                  <View key={t.id} style={styles.card}>
                    <SubjectIcon name={t.subject} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{t.title}</Text>
                      <Text style={styles.cardSub}>Entrega · {t.subject}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: c.bg }]}>
                      <Text style={[styles.badgeText, { color: c.fg }]}>{t.completed ? "hecha" : "pendiente"}</Text>
                    </View>
                  </View>
                );
              })}
              {selectedEvents.sessions.map((s) => (
                <View key={s.id} style={styles.card}>
                  <View style={styles.sessionIcon}>
                    <Text style={{ color: colors.onBrandTertiary, fontWeight: "800" }}>◔</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Sesión de estudio</Text>
                    <Text style={styles.cardSub}>{s.duration_min} minutos {s.subject ? `· ${s.subject}` : ""}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },
  monthTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  navBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  navText: { fontSize: 22, color: colors.onSurface, lineHeight: 22 },
  grid: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  gridRow: { flexDirection: "row" },
  dayLabel: { flex: 1, textAlign: "center", color: colors.muted, fontSize: 12, fontWeight: "700", paddingVertical: 8 },
  cell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  dayPill: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dayPillActive: { backgroundColor: colors.brandPrimary },
  dayPillToday: { backgroundColor: colors.brandTertiary },
  dayText: { color: colors.onSurface, fontSize: 14 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brandPrimary },
  sectionTitle: { color: colors.onSurface, fontWeight: "800", fontSize: 15, marginBottom: spacing.xs },
  empty: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  emptySub: { color: colors.muted, fontSize: 13 },
  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  cardSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: "700" },
  sessionIcon: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
});
