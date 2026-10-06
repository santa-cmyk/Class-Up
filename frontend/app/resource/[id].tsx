import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Icon } from "@/src/components/icon";
import { SubjectIcon } from "@/src/components/subject-icon";
import { YouTubePlayer } from "@/src/components/youtube-player";
import { colors, radius, spacing, subjectColor } from "@/src/theme";

type Resource = {
  id: string; title: string; area: string; topic: string; subtopic?: string;
  type: string; difficulty: string; url: string; thumbnail?: string; grade?: number;
};

const DIFF_LABEL: Record<string, string> = {
  basico: "Básico",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};

/** Returns an 11-char YouTube video id, or null when the URL is not a video URL. */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/(?:shorts|embed|live)\/)([\w-]{11})/,
  );
  return m ? m[1] : null;
}

export default function ResourceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: resource, isLoading, error } = useQuery<Resource>({
    queryKey: ["resource", id],
    queryFn: () => api.get<Resource>(`/resources/${id}`),
    enabled: !!id,
  });

  const videoId = resource ? extractYouTubeId(resource.url) : null;

  const openExternal = async () => {
    if (!resource) return;
    try {
      if (Platform.OS === "web") window.open(resource.url, "_blank");
      else await WebBrowser.openBrowserAsync(resource.url);
    } catch {
      Linking.openURL(resource.url);
    }
  };

  const c = resource ? subjectColor(resource.area) : { bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary, solid: colors.muted };

  return (
    <View style={styles.root} testID="resource-detail-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} testID="rd-back" hitSlop={10}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Detalle del recurso</Text>
        <View style={{ width: 60 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>
      ) : error || !resource ? (
        <View style={styles.center} testID="rd-error">
          <Text style={styles.errorTitle}>No se pudo cargar el recurso</Text>
          <Text style={styles.errorSub}>{(error as any)?.message ?? "Recurso no encontrado"}</Text>
          <Pressable onPress={() => router.back()} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Volver a Recursos</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.md }}>
          {/* Player or fallback */}
          {videoId ? (
            <YouTubePlayer videoId={videoId} />
          ) : (
            <View style={[styles.noVideoCard, { backgroundColor: c.bg }]} testID="no-video-card">
              <View style={styles.noVideoIcon}>
                <Text style={[styles.noVideoIconText, { color: c.fg }]}>▶</Text>
              </View>
              <Text style={[styles.noVideoTitle, { color: c.fg }]}>Sin video reproducible</Text>
              <Text style={[styles.noVideoSub, { color: c.fg }]}>
                Este recurso apunta a una búsqueda de YouTube. Ábrelo externamente para ver los resultados.
              </Text>
            </View>
          )}

          {/* Header card */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <SubjectIcon name={resource.area} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{resource.title}</Text>
                <Text style={styles.area}>{resource.area}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <DetailRow label="Tema" value={resource.topic || "—"} />
            {resource.subtopic ? <DetailRow label="Subtema" value={resource.subtopic} /> : null}
            <DetailRow label="Nivel de dificultad" value={DIFF_LABEL[resource.difficulty] ?? resource.difficulty} />
            <DetailRow label="Tipo" value={resource.type === "video" ? "Video" : resource.type} />
            {resource.grade ? <DetailRow label="Grado" value={`${resource.grade}°`} /> : null}
          </View>

          {/* Actions */}
          <Pressable onPress={openExternal} style={styles.primaryBtn} testID="rd-open-external">
            <Icon name="play" size={16} color={colors.onBrandPrimary} weight="800" />
            <Text style={styles.primaryBtnText}>Abrir en YouTube</Text>
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.secondaryBtn} testID="rd-back-btn">
            <Text style={styles.secondaryBtnText}>Volver a Recursos</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { color: colors.muted, fontSize: 14, fontWeight: "700", width: 60 },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  errorTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" },
  errorSub: { color: colors.muted, fontSize: 13, textAlign: "center" },

  noVideoCard: {
    width: "100%", aspectRatio: 16 / 9, borderRadius: radius.lg,
    alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.sm,
  },
  noVideoIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center", justifyContent: "center",
  },
  noVideoIconText: { fontSize: 16 },
  noVideoTitle: { fontSize: 15, fontWeight: "800" },
  noVideoSub: { fontSize: 12, textAlign: "center", lineHeight: 18 },

  infoCard: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.xs,
  },
  infoHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  title: { color: colors.onSurface, fontSize: 17, fontWeight: "800", lineHeight: 22 },
  area: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 4 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, paddingVertical: 6 },
  rowLabel: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  rowValue: { color: colors.onSurface, fontSize: 13, fontWeight: "700", flexShrink: 1, textAlign: "right" },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    backgroundColor: colors.brandPrimary, borderRadius: radius.pill,
    paddingVertical: 15,
  },
  primaryBtnText: { color: colors.onBrandPrimary, fontSize: 15, fontWeight: "800" },
  secondaryBtn: {
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill,
    paddingVertical: 14, borderWidth: 1, borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
});
