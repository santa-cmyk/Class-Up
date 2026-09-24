// Design tokens for Class Up · El Castillo. Light theme only for now.
// Values are pulled from /app/design_guidelines.json (Tactile / Playful LIGHT).

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  // Surfaces
  surface: "#FAFAFA",
  onSurface: "#18181B",
  surfaceSecondary: "#F4F4F5",
  onSurfaceSecondary: "#27272A",
  surfaceTertiary: "#E4E4E7",
  onSurfaceTertiary: "#3F3F46",
  surfaceInverse: "#18181B",
  onSurfaceInverse: "#FAFAFA",
  muted: "#71717A",

  // Brand (Emerald / Mint)
  brand: "#10B981",
  onBrand: "#FFFFFF",
  brandPrimary: "#10B981",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#F59E0B",
  onBrandSecondary: "#18181B",
  brandTertiary: "#D1FAE5",
  onBrandTertiary: "#065F46",

  // Status
  success: "#22C55E",
  onSuccess: "#FFFFFF",
  warning: "#F59E0B",
  onWarning: "#18181B",
  error: "#EF4444",
  onError: "#FFFFFF",
  info: "#14B8A6",
  onInfo: "#FFFFFF",

  // Lines
  border: "#E4E4E7",
  borderStrong: "#A1A1AA",
  divider: "#E4E4E7",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

// Spacing & radius tokens from design_guidelines.json
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

// Subject color mapping for consistent usage across screens
export const subjectColors: Record<string, { bg: string; fg: string; solid: string }> = {
  "Lectura Crítica": { bg: "#FFEDD5", fg: "#9A3412", solid: "#F97316" },
  "Matemáticas": { bg: "#D1FAE5", fg: "#065F46", solid: "#10B981" },
  "Sociales y Ciudadanas": { bg: "#FEF3C7", fg: "#92400E", solid: "#F59E0B" },
  "Ciencias Naturales": { bg: "#CCFBF1", fg: "#115E59", solid: "#14B8A6" },
  "Inglés": { bg: "#FCE7F3", fg: "#9D174D", solid: "#EC4899" },
};

export function subjectColor(name: string) {
  return (
    subjectColors[name] ?? { bg: "#E4E4E7", fg: "#27272A", solid: "#71717A" }
  );
}

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export const colors = light;

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
