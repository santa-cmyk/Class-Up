import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useAuth, StudentUser } from "@/src/auth/AuthContext";
import { SubjectIcon } from "@/src/components/subject-icon";
import { colors, radius, spacing } from "@/src/theme";

type AssessmentsResp = {
  subjects: { name: string; url: string; opened: boolean }[];
  completed: boolean;
};

const SECTIONS = ["A", "B", "C", "D"];
const JORNADAS = ["Mañana", "Tarde", "Única"];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshUser, signOut } = useAuth();
  const [step, setStep] = useState<1 | 2>(user?.profile_setup_completed ? 2 : 1);

  useEffect(() => {
    if (user?.profile_setup_completed) setStep(2);
  }, [user?.profile_setup_completed]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="onboarding-screen">
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brandText}>CLASS UP · EL CASTILLO</Text>
        </View>
        <Pressable onPress={signOut} testID="onboarding-signout" hitSlop={10}>
          <Text style={styles.signout}>Salir</Text>
        </Pressable>
      </View>

      <View style={styles.stepIndicator}>
        <StepDot n={1} label="Datos" active={step >= 1} done={step > 1} />
        <View style={styles.stepLine} />
        <StepDot n={2} label="Evaluaciones" active={step >= 2} />
      </View>

      {step === 1 ? (
        <ProfileForm onDone={async () => { await refreshUser(); setStep(2); }} initial={user} />
      ) : (
        <AssessmentsStep onSubmitted={refreshUser} />
      )}
    </View>
  );
}

function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done?: boolean }) {
  return (
    <View style={styles.stepItem}>
      <View style={[styles.dot, active && styles.dotActive, done && styles.dotDone]}>
        <Text style={[styles.dotText, active && { color: colors.onBrandPrimary }]}>{done ? "✓" : n}</Text>
      </View>
      <Text style={[styles.stepLabel, active && { color: colors.onSurface, fontWeight: "800" }]}>{label}</Text>
    </View>
  );
}

/* ------------------------------- Step 1 ---------------------------------- */
function ProfileForm({ onDone, initial }: { onDone: () => void; initial: StudentUser | null }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [section, setSection] = useState(initial?.section ?? "");
  const [jornada, setJornada] = useState(initial?.jornada ?? "");
  const [birthDate, setBirthDate] = useState(initial?.birth_date ?? "");
  const [studentPhone, setStudentPhone] = useState(initial?.student_phone ?? "");
  const [guardianName, setGuardianName] = useState(initial?.guardian_name ?? "");
  const [guardianPhone, setGuardianPhone] = useState(initial?.guardian_phone ?? "");
  const [error, setError] = useState<string | null>(null);

  const saveMut = useMutation({
    mutationFn: () =>
      api.post("/profile/setup", {
        name,
        section,
        jornada,
        birth_date: birthDate,
        student_phone: studentPhone,
        guardian_name: guardianName,
        guardian_phone: guardianPhone,
      }),
    onSuccess: onDone,
    onError: (e: any) => setError(e?.message || "Error al guardar"),
  });

  const canContinue =
    name.trim().length > 1 &&
    section.trim() &&
    jornada.trim() &&
    /^\d{4}-\d{2}-\d{2}$/.test(birthDate.trim()) &&
    guardianName.trim().length > 1 &&
    guardianPhone.trim().length >= 7;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.sm }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Configura tu perfil</Text>
        <Text style={styles.subtitle}>
          Todos los campos marcados son obligatorios. Solo así podremos personalizar tu experiencia.
        </Text>

        <Field label="Nombre completo *" testID="field-name">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ej. Juan Pérez"
            placeholderTextColor={colors.muted}
            style={styles.input}
            testID="input-name"
          />
        </Field>

        <Field label="Grupo / Sección *" testID="field-section">
          <View style={styles.rowChips}>
            {SECTIONS.map((s) => (
              <Pressable key={s} onPress={() => setSection(s)} style={[styles.chip, section === s && styles.chipActive]} testID={`section-${s}`}>
                <Text style={[styles.chipText, section === s && { color: colors.onBrandPrimary }]}>9°{s}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="Jornada *" testID="field-jornada">
          <View style={styles.rowChips}>
            {JORNADAS.map((j) => (
              <Pressable key={j} onPress={() => setJornada(j)} style={[styles.chip, jornada === j && styles.chipActive]} testID={`jornada-${j}`}>
                <Text style={[styles.chipText, jornada === j && { color: colors.onBrandPrimary }]}>{j}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="Fecha de nacimiento * (AAAA-MM-DD)" testID="field-birthdate">
          <TextInput
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="2010-05-15"
            placeholderTextColor={colors.muted}
            style={styles.input}
            testID="input-birthdate"
          />
        </Field>

        <Field label="Teléfono del estudiante (opcional)" testID="field-phone">
          <TextInput
            value={studentPhone}
            onChangeText={setStudentPhone}
            placeholder="Ej. 300 123 4567"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            style={styles.input}
            testID="input-phone"
          />
        </Field>

        <Field label="Nombre del acudiente *" testID="field-guardian-name">
          <TextInput
            value={guardianName}
            onChangeText={setGuardianName}
            placeholder="Ej. María Pérez"
            placeholderTextColor={colors.muted}
            style={styles.input}
            testID="input-guardian-name"
          />
        </Field>

        <Field label="Teléfono del acudiente *" testID="field-guardian-phone">
          <TextInput
            value={guardianPhone}
            onChangeText={setGuardianPhone}
            placeholder="Ej. 301 234 5678"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            style={styles.input}
            testID="input-guardian-phone"
          />
        </Field>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          onPress={() => canContinue && saveMut.mutate()}
          disabled={!canContinue || saveMut.isPending}
          style={[styles.cta, (!canContinue || saveMut.isPending) && styles.ctaDisabled]}
          testID="profile-continue"
        >
          {saveMut.isPending ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <Text style={styles.ctaText}>Guardar y continuar</Text>
          )}
        </Pressable>
        {!canContinue ? (
          <Text style={styles.helpText}>Completa todos los campos obligatorios (*) para continuar.</Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children, testID }: { label: string; children: React.ReactNode; testID?: string }) {
  return (
    <View style={{ marginTop: spacing.sm }} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

/* ------------------------------- Step 2 ---------------------------------- */
function AssessmentsStep({ onSubmitted }: { onSubmitted: () => Promise<void> }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useQuery<AssessmentsResp>({
    queryKey: ["assessments"],
    queryFn: () => api.get<AssessmentsResp>("/assessments"),
  });

  const openMut = useMutation({
    mutationFn: (subject: string) => api.post("/assessments/open", { subject }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessments"] }),
  });

  const completeMut = useMutation({
    mutationFn: () => api.post("/assessments/complete", { completed: true }),
    onSuccess: async () => { setError(null); await onSubmitted(); },
    onError: (e: any) => setError(e?.message ?? "No se pudo completar"),
  });

  const openForm = async (subject: string, url: string) => {
    openMut.mutate(subject);
    try {
      if (Platform.OS === "web") window.open(url, "_blank");
      else await WebBrowser.openBrowserAsync(url);
    } catch {
      Linking.openURL(url);
    }
  };

  const opened = (data?.subjects ?? []).filter((s) => s.opened).length;
  const canContinue = opened === 5;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"], gap: spacing.sm }}>
      <Text style={styles.title}>Evaluación inicial</Text>
      <Text style={styles.subtitle}>
        Antes de comenzar, completa estas cinco evaluaciones para que Class Up pueda conocer tus
        fortalezas y los temas que necesitas reforzar.
      </Text>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(opened / 5) * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>{opened} de 5 evaluaciones abiertas</Text>

      {isLoading || !data ? (
        <View style={{ paddingVertical: spacing["2xl"] }}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : (
        data.subjects.map((s) => (
          <View key={s.name} style={styles.card} testID={`assessment-card-${s.name}`}>
            <View style={styles.cardTop}>
              <SubjectIcon name={s.name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{s.name}</Text>
                <Text style={[styles.cardSub, s.opened && { color: colors.success }]}>
                  {s.opened ? "✓ Evaluación abierta" : "Pendiente por abrir"}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => openForm(s.name, s.url)}
              style={styles.cardCta}
              testID={`assessment-open-${s.name}`}
            >
              <Text style={styles.cardCtaText}>{s.opened ? "Abrir de nuevo" : "Abrir evaluación"}</Text>
            </Pressable>
          </View>
        ))
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        onPress={() => canContinue && completeMut.mutate()}
        disabled={!canContinue || completeMut.isPending}
        style={[styles.cta, (!canContinue || completeMut.isPending) && styles.ctaDisabled]}
        testID="assessment-continue"
      >
        {completeMut.isPending ? (
          <ActivityIndicator color={colors.onBrandPrimary} />
        ) : (
          <Text style={styles.ctaText}>Continuar a Class Up</Text>
        )}
      </Pressable>
      {!canContinue ? (
        <Text style={styles.helpText}>Abre las 5 evaluaciones para desbloquear el botón.</Text>
      ) : null}
      <Text style={styles.footNote}>
        Podrás repetir estas evaluaciones más tarde desde tu perfil.
      </Text>
    </ScrollView>
  );
}

/* --------------------------------- styles -------------------------------- */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary },
  brandText: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2, color: colors.onSurface },
  signout: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  stepIndicator: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, paddingBottom: spacing.md,
  },
  stepItem: { alignItems: "center", gap: 4 },
  dot: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceTertiary,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
  dotActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  dotDone: { backgroundColor: colors.success, borderColor: colors.success },
  dotText: { color: colors.onSurface, fontWeight: "800", fontSize: 13 },
  stepLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  stepLine: { flex: 0, width: 40, height: 2, backgroundColor: colors.border, marginBottom: 18 },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.5 },
  subtitle: {
    color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm,
  },
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
  progressBar: {
    height: 8, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill,
    overflow: "hidden", marginTop: spacing.sm,
  },
  progressFill: { height: "100%", backgroundColor: colors.brandPrimary, borderRadius: radius.pill },
  progressText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  card: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg,
    gap: spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cardTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "700" },
  cardSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  cardCta: {
    backgroundColor: colors.onSurface, borderRadius: radius.pill,
    paddingVertical: 12, alignItems: "center",
  },
  cardCtaText: { color: colors.surface, fontWeight: "700", fontSize: 14 },
  cta: {
    backgroundColor: colors.brandPrimary, borderRadius: radius.pill,
    paddingVertical: 16, alignItems: "center", marginTop: spacing.lg,
  },
  ctaDisabled: { backgroundColor: colors.surfaceTertiary },
  ctaText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "800" },
  helpText: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: spacing.xs },
  errorText: { color: colors.error, fontSize: 13, textAlign: "center", marginTop: spacing.sm },
  footNote: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: spacing.md },
});
