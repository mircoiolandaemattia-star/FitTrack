import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, router } from "expo-router";
import { UserPlus } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister() {
    if (submitting) return;
    setError(null);

    if (!name.trim() || !email.trim() || !password) {
      setError("Compila tutti i campi.");
      return;
    }
    if (password.length < 6) {
      setError("La password deve avere almeno 6 caratteri.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Le password non coincidono.");
      return;
    }

    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
      // Nuovo utente → il guard radice porta all'onboarding.
      router.replace("/");
    } catch {
      setError("Registrazione non riuscita. Riprova.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen className="justify-center">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-center px-6"
      >
        <View className="mb-8 items-center gap-4">
          <View className="h-20 w-20 items-center justify-center rounded-3xl bg-primary/15">
            <UserPlus size={36} color="#F97316" strokeWidth={2.2} />
          </View>
          <Text className="font-inter-bold text-4xl text-foreground">Crea account</Text>
        </View>

        <View className="gap-4">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nome"
            placeholderTextColor="#64748B"
            autoComplete="name"
            className="rounded-xl border border-border bg-surface px-4 py-3.5 font-sans text-foreground"
          />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            className="rounded-xl border border-border bg-surface px-4 py-3.5 font-sans text-foreground"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#64748B"
            secureTextEntry
            autoCapitalize="none"
            className="rounded-xl border border-border bg-surface px-4 py-3.5 font-sans text-foreground"
          />
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Conferma password"
            placeholderTextColor="#64748B"
            secureTextEntry
            autoCapitalize="none"
            className="rounded-xl border border-border bg-surface px-4 py-3.5 font-sans text-foreground"
          />

          {error ? (
            <Text className="font-sans text-sm text-destructive">{error}</Text>
          ) : null}

          <Pressable
            onPress={handleRegister}
            disabled={submitting}
            className={`mt-2 items-center rounded-xl bg-primary py-3.5 active:opacity-80 ${
              submitting ? "opacity-50" : ""
            }`}
          >
            <Text className="font-inter-bold text-base text-primary-foreground">
              {submitting ? "Creazione…" : "Registrati"}
            </Text>
          </Pressable>
        </View>

        <View className="mt-8 flex-row justify-center gap-1">
          <Text className="font-sans text-sm text-muted">Hai già un account?</Text>
          <Link href="/(auth)/login" className="font-inter-semibold text-sm text-primary">
            Accedi
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}