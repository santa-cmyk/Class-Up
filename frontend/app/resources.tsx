import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { colors, radius, spacing, subjectColor } from "@/src/theme";

type Resource = {
  id: string; title: string; area: string; topic: string; subtopic?: string;
  type: string; difficulty: string; url: string; thumbnail?: string;
};

const AREAS = ["Todos", "Lectura Crítica", "Matemáticas", "Sociales", "Ciencias Naturales", "Inglés"];

const DIFF_LABEL: Record<string, string> = { basico: "Básico", intermedio: "Intermedio", avanzado: "Avanzado" };

export default function ResourcesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [area, setArea] = useState<string>("Todos");

  const { data, isLoading } = useQuery<Resource[]>({
    queryKey: ["resources", area],
    queryFn: () => api.get(`/resources${area !== "Todos" ? `?area=${encodeURIComponent(area)}` : ""}`),
  });

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} testID="res-back" hitSlop={10}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>Recursos</Text>
        <Text style={styles.subtitle}>Videos y materiales de estudio</Text>
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg, paddingTop: spacing.md }}
        >
          {AREAS.map((a) => (
            <Pressable
              key={a} onPress={() => setArea(a)}
              style={[styles.chip, area === a && styles.chipActive]} testID={`res-chip-${a}`}
            >
              <Text style={[styles.chipText, area === a && styles.chipTextActive]}>{a}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.brandPrimary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100, gap: spacing.md }}>
          {(data ?? []).length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptySub}>Sin recursos en esta categoría.</Text></View>
          ) : (
            <View style={styles.grid}>
              {(data ?? []).map((r) => {
                const c = subjectColor(r.area);
                return (
                  <Pressable
                    key={r.id} onPress={() => router.push(`/resource/${r.id}` as any)} style={styles.card} testID={`resource-${r.id}`}
                  >
                    <View style={styles.thumbWrap}>
                      {r.thumbnail ? (
                        <Image source={{ uri: r.thumbnail }} style={styles.thumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.thumb, { backgroundColor: c.bg }]} />
                      )}
                      <View style={styles.playBadge}>
                        <Text style={styles.playBadgeText}>▶</Text>
                      </View>
                      <View style={[styles.diffBadge, { backgroundColor: c.bg }]}>
                        <Text style={[styles.diffBadgeText, { color: c.fg }]}>
                          {DIFF_LABEL[r.difficulty] ?? r.difficulty}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={2}>{r.title}</Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>{r.area} · {r.topic}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface, marginTop: spacing.sm },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  chip: {
    paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
    flexShrink: 0, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.onSurface, borderColor: colors.onSurface },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
  chipTextActive: { color: colors.surface },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: {
    width: "47%", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    overflow: "hidden", borderWidth: 1, borderColor: colors.border, padding: spacing.sm, gap: 6,
  },
  thumbWrap: { position: "relative", width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden" },
  thumb: { width: "100%", height: "100%" },
  playBadge: {
    position: "absolute", top: "50%", left: "50%",
    width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center", marginLeft: -18, marginTop: -18,
  },
  playBadgeText: { color: "#fff", fontSize: 12 },
  diffBadge: {
    position: "absolute", top: 6, left: 6,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
  },
  diffBadgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  cardTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "700", marginTop: 4 },
  cardMeta: { color: colors.muted, fontSize: 11 },
  empty: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  emptySub: { color: colors.muted, fontSize: 13 },
});
