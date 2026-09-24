import { StyleSheet, Text, View } from "react-native";

/**
 * Lightweight glyph icons using unicode symbols wrapped in a themed container.
 * We keep this internal to avoid pulling a full icon font and to work fully in
 * Expo Go / web previews.
 */
const GLYPHS: Record<string, string> = {
  home: "⌂",
  tasks: "✓",
  calendar: "◱",
  profile: "◉",
  grades: "★",
  timer: "◔",
  resources: "▤",
  plus: "＋",
  play: "▶",
  pause: "❚❚",
  reset: "↺",
  chevron: "›",
  trash: "🗑",
  logout: "⇤",
  book: "❐",
  check: "✓",
  clock: "◔",
  flag: "⚑",
};

export type IconName = keyof typeof GLYPHS;

export function Icon({
  name,
  size = 20,
  color = "#111",
  weight = "700",
}: {
  name: IconName;
  size?: number;
  color?: string;
  weight?: "400" | "600" | "700" | "800";
}) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Text style={[styles.g, { color, fontSize: size, fontWeight: weight, lineHeight: size * 1.05 }]}>
        {GLYPHS[name]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  g: { textAlign: "center", includeFontPadding: false as any },
});
