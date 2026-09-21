import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { Check, Mail, Lock, User } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordStrengthIndicator, getPasswordStrength } from "@/components/auth/PasswordStrengthIndicator";

function isEmailValid(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function RegisterScreen() {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const firstNameValid = firstName.trim().length >= 2;
  const lastNameValid = lastName.trim().length >= 2;
  const emailValid = isEmailValid(email);
  const pwStrength = getPasswordStrength(password);
  const pwValid = password.length >= 6;
  const confirmValid = confirmPassword.length > 0 && confirmPassword === password;

  const canSubmit = useMemo(() => {
    return firstNameValid && lastNameValid && emailValid && pwValid && confirmValid && accepted && !submitting;
  }, [firstNameValid, lastNameValid, emailValid, pwValid, confirmValid, accepted, submitting]);

  async function handleRegister() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      await register(fullName, email.trim(), password);
      router.replace("/");
    } catch {
      setError("Registrazione non riuscita. Riprova.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen className="justify-center">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 justify-center px-6 py-6">
        <View className="mb-8 items-center gap-4">
          <View className="h-20 w-20 items-center justify-center rounded-3xl bg-primary/15">
            <User size={36} color="#F97316" strokeWidth={2.2} />
          </View>
          <Text className="font-inter-bold text-3xl text-foreground">Crea account</Text>
          <Text className="text-center font-sans text-sm text-muted">Unisciti a FitTrack in pochi secondi.</Text>
        </View>

        <View className="gap-4">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <AuthInput
                icon={<User size={16} color="#94A3B8" />}
                placeholder="Nome"
                autoComplete="given-name"
                textContentType="givenName"
                autoCapitalize="words"
                value={firstName}
                onChangeText={setFirstName}
                error={!!firstName && !firstNameValid}
                errorMessage={!!firstName && !firstNameValid ? "Min 2 caratteri" : undefined}
              />
            </View>
            <View className="flex-1">
              <AuthInput
                icon={<User size={16} color="#94A3B8" />}
                placeholder="Cognome"
                autoComplete="family-name"
                textContentType="familyName"
                autoCapitalize="words"
                value={lastName}
                onChangeText={setLastName}
                error={!!lastName && !lastNameValid}
                errorMessage={!!lastName && !lastNameValid ? "Min 2 caratteri" : undefined}
              />
            </View>
          </View>
          <AuthInput
            icon={<Mail size={16} color="#94A3B8" />}
            placeholder="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            error={!!email && !emailValid}
            errorMessage={!!email && !emailValid ? "Formato email non valido" : undefined}
          />
          <View className="gap-2">
            <AuthInput
              icon={<Lock size={16} color="#94A3B8" />}
              placeholder="Password"
              autoCapitalize="none"
              secureTextEntry
              isPassword
              value={password}
              onChangeText={setPassword}
              error={!!password && !pwValid}
              errorMessage={!!password && !pwValid ? "Minimo 6 caratteri" : undefined}
            />
            <PasswordStrengthIndicator password={password} />
          </View>

          <AuthInput
            icon={<Lock size={16} color="#94A3B8" />}
            placeholder="Conferma password"
            autoCapitalize="none"
            secureTextEntry
            isPassword
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={!!confirmPassword && !confirmValid}
            errorMessage={!!confirmPassword && !confirmValid ? "Le password non coincidono" : undefined}
          />

          <Pressable onPress={() => setAccepted((v) => !v)} className="flex-row items-start gap-3 py-1 active:opacity-80">
            <View className={`mt-0.5 h-5 w-5 items-center justify-center rounded-md border-2 ${accepted ? "border-primary bg-primary" : "border-border bg-transparent"}`}>
              {accepted ? <Check size={12} color="#0F172A" strokeWidth={3} /> : null}
            </View>
            <Text className="flex-1 font-sans text-sm leading-5 text-muted">
              Accetto i <Text className="font-inter-semibold text-primary">termini e condizioni</Text>
            </Text>
          </Pressable>

          {error ? <Text className="font-sans text-sm text-destructive">{error}</Text> : null}

          <Pressable
            onPress={handleRegister}
            disabled={!canSubmit}
            className={`mt-2 items-center rounded-xl py-3.5 active:opacity-80 ${canSubmit ? "bg-primary" : "bg-primary/40 opacity-60"}`}
          >
            <Text className="font-inter-bold text-base text-primary-foreground">{submitting ? "Creazione…" : "Registrati"}</Text>
          </Pressable>
        </View>

        <View className="mt-8 flex-row items-center justify-center gap-1">
          <Text className="font-sans text-sm text-muted">Hai già un account?</Text>
          <Link href="/(auth)/login" asChild>
            <Pressable className="active:opacity-60">
              <Text className="font-inter-semibold text-sm text-primary">Accedi</Text>
            </Pressable>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
