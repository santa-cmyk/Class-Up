import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { colors, radius, spacing } from "@/src/theme";

const SECTIONS = ["A", "B", "C", "D"];
const JORNADAS = ["Mañana", "Tarde", "Única"];

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [section, setSection] = useState(user?.section ?? "");
  const [jornada, setJornada] = useState(user?.jornada ?? "");
  const [birthDate, setBirthDate] = useState(user?.birth_date ?? "");
  const [studentPhone, setStudentPhone] = useState(user?.student_phone ?? "");
  const [guardianName, setGuardianName] = useState(user?.guardian_name ?? "");
  const [guardianPhone, setGuardianPhone] = useState(user?.guardian_phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const saveMut = useMutation({
    mutationFn: () =>
      api.patch("/profile", {
        name,
        section,
        jornada,
        birth_date: birthDate,
        student_phone: studentPhone,
        guardian_name: guardianName,
        guardian_phone: guardianPhone,
      }),
    onSuccess: async () => {
      setError(null);
      setSaved(true);
      await refreshUser();
      setTimeout(() => setSaved(false), 1600);
    },
    onError: (e: any) => setError(e?.message || "No se pudo guardar"),
  });

  const canSave =
    name.trim().length > 1 &&
    section.trim() &&
    jornada.trim() &&
    /^\d{4}-\d{2}-\d{2}$/.test(birthDate.trim()) &&
    guardianName.trim().length > 1 &&
    guardianPhone.trim().length >= 7;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="profile-edit-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="pe-back" hitSlop={10}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Editar mi perfil</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.sm }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.subtitle}>
            Actualiza tus datos personales. Los cambios se guardan al instante.
          </Text>

          <Field label="Nombre completo *">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Tu nombre"
              placeholderTextColor={colors.muted}
              style={styles.input}
              testID="pe-name"
            />
          </Field>

          <Field label="Correo (no editable)">
            <TextInput
              value={user?.email ?? ""}
              editable={false}
              style={[styles.input, { color: colors.muted }]}
            />
          </Field>

          <Field label="Grado (no editable)">
            <TextInput
              value={user?.grade ?? "9°"}
              editable={false}
              style={[styles.input, { color: colors.muted }]}
            />
          </Field>

          <Field label="Grupo / Sección *">
            <View style={styles.rowChips}>
              {SECTIONS.map((s) => (
                <Pressable
                  key={s} onPress={() => setSection(s)}
                  style={[styles.chip, section === s && styles.chipActive]}
                  testID={`pe-section-${s}`}
                >
                  <Text style={[styles.chipText, section === s && { color: colors.onBrandPrimary }]}>9°{s}</Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label="Jornada *">
            <View style={styles.rowChips}>
              {JORNADAS.map((j) => (
                <Pressable
                  key={j} onPress={() => setJornada(j)}
                  style={[styles.chip, jornada === j && styles.chipActive]}
                  testID={`pe-jornada-${j}`}
                >
                  <Text style={[styles.chipText, jornada === j && { color: colors.onBrandPrimary }]}>{j}</Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label="Fecha de nacimiento * (AAAA-MM-DD)">
            <TextInput
              value={birthDate} onChangeText={setBirthDate}
              placeholder="2010-05-15" placeholderTextColor={colors.muted}
              style={styles.input} testID="pe-birthdate"
            />
          </Field>

          <Field label="Teléfono del estudiante (opcional)">
            <TextInput
              value={studentPhone} onChangeText={setStudentPhone}
              placeholder="Ej. 300 123 4567" placeholderTextColor={colors.muted}
              keyboardType="phone-pad" style={styles.input} testID="pe-phone"
            />
          </Field>

          <Field label="Nombre del acudiente *">
            <TextInput
              value={guardianName} onChangeText={setGuardianName}
              placeholder="Ej. María Pérez" placeholderTextColor={colors.muted}
              style={styles.input} testID="pe-guardian-name"
            />
          </Field>

          <Field label="Teléfono del acudiente *">
            <TextInput
              value={guardianPhone} onChangeText={setGuardianPhone}
              placeholder="Ej. 301 234 5678" placeholderTextColor={colors.muted}
              keyboardType="phone-pad" style={styles.input} testID="pe-guardian-phone"
            />
          </Field>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {saved ? <Text style={styles.savedText}>✓ Cambios guardados</Text> : null}

          <Pressable
            onPress={() => canSave && saveMut.mutate()}
            disabled={!canSave || saveMut.isPending}
            style={[styles.cta, (!canSave || saveMut.isPending) && styles.ctaDisabled]}
            testID="pe-save"
          >
            {saveMut.isPending ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={styles.ctaText}>Guardar cambios</Text>
            )}
          </Pressable>
          {!canSave ? (
            <Text style={styles.helpText}>Revisa los campos obligatorios (*).</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.sm }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { color: colors.muted, fontSize: 14, fontWeight: "700", width: 60 },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" },
  subtitle: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20 },
  label: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.md, padding: 14, color: colors.onSurface, fontSize: 15,
  },
  rowChips: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurface, fontWeight: "700", fontSize: 13 },
  cta: {
    backgroundColor: colors.brandPrimary, borderRadius: radius.pill,
    paddingVertical: 16, alignItems: "center", marginTop: spacing.lg,
  },
  ctaDisabled: { backgroundColor: colors.surfaceTertiary },
  ctaText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "800" },
  helpText: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: spacing.xs },
  errorText: { color: colors.error, fontSize: 13, textAlign: "center", marginTop: spacing.sm },
  savedText: { color: colors.success, fontSize: 13, textAlign: "center", marginTop: spacing.sm, fontWeight: "700" },
});
