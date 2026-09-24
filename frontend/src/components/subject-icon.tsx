import { StyleSheet, Text, View } from "react-native";

import { subjectColor } from "@/src/theme";

// Simple compact monogram icon for subjects (avoids emoji, avoids extra libs).
const MONOGRAM: Record<string, string> = {
  "Lectura Crítica": "Lc",
  "Matemáticas": "Mt",
  "Sociales y Ciudadanas": "Sc",
  "Ciencias Naturales": "Cn",
  "Inglés": "In",
};

export function SubjectIcon({ name, size = 44 }: { name: string; size?: number }) {
  const c = subjectColor(name);
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 3, backgroundColor: c.bg },
      ]}
    >
      <Text style={[styles.txt, { color: c.fg, fontSize: size * 0.36 }]}>
        {MONOGRAM[name] ?? name.slice(0, 2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  txt: { fontWeight: "800", letterSpacing: -0.5 },
});
