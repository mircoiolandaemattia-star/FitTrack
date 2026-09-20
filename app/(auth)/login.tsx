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
import { Dumbbell } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    if (submitting) return;
    setError(null);
    if (!email.trim() || !password) {
      setError("Inserisci email e password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      // Il guard radice reindirizza verso onboarding o tab.
      router.replace("/");
    } catch {
      setError("Login non riuscito. Riprova.");
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
        <View className="mb-10 items-center gap-4">
          <View className="h-20 w-20 items-center justify-center rounded-3xl bg-primary/15">
            <Dumbbell size={36} color="#F97316" strokeWidth={2.2} />
          </View>
          <Text className="font-inter-bold text-4xl text-foreground">FitTrack</Text>
          <Text className="text-center font-sans text-base text-muted">
            Monitora allenamenti, dieta e progressi.
          </Text>
        </View>

        <View className="gap-4">
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

          {error ? (
            <Text className="font-sans text-sm text-destructive">{error}</Text>
          ) : null}

          <Pressable
            onPress={handleLogin}
            disabled={submitting}
            className={`mt-2 items-center rounded-xl bg-primary py-3.5 active:opacity-80 ${
              submitting ? "opacity-50" : ""
            }`}
          >
            <Text className="font-inter-bold text-base text-primary-foreground">
              {submitting ? "Accesso…" : "Accedi"}
            </Text>
          </Pressable>
        </View>

        <View className="mt-8 flex-row items-center justify-center gap-1">
          <Text className="font-sans text-sm text-muted">Non hai un account?</Text>
          <Link href="/(auth)/register" asChild>
            <Pressable className="active:opacity-60">
              <Text className="font-inter-semibold text-sm text-primary">Registrati</Text>
            </Pressable>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}