import { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { Dumbbell, Mail, Lock } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/lib/auth";
import { AuthInput } from "@/components/auth/AuthInput";

function isEmailValid(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const emailValid = useMemo(() => !email || isEmailValid(email), [email]);

  async function handleLogin() {
    if (submitting) return;
    setError(null);
    setFormError(false);

    if (!email.trim() || !password) {
      setError("Inserisci email e password.");
      setFormError(true);
      return;
    }
    if (!isEmailValid(email)) {
      setError("Formato email non valido.");
      setFormError(true);
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch {
      setError("Email o password errati");
      setFormError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen className="justify-center">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 justify-center px-6">
        <View className="mb-10 items-center gap-4">
          <View className="h-20 w-20 items-center justify-center rounded-3xl bg-primary/15">
            <Dumbbell size={36} color="#F97316" strokeWidth={2.2} />
          </View>
          <Text className="font-inter-bold text-4xl text-foreground">FitTrack</Text>
          <Text className="text-center font-sans text-base text-muted">Monitora allenamenti, dieta e progressi.</Text>
        </View>

        <View className="gap-4">
          <AuthInput
            icon={<Mail size={16} color="#94A3B8" />}
            placeholder="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (formError) setFormError(false);
            }}
            error={formError || (!!email && !emailValid)}
            errorMessage={!emailValid && email ? "Formato email non valido" : undefined}
          />
          <AuthInput
            icon={<Lock size={16} color="#94A3B8" />}
            placeholder="Password"
            autoCapitalize="none"
            secureTextEntry
            isPassword
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (formError) setFormError(false);
            }}
            error={formError}
          />

          {error ? <Text className="font-sans text-sm text-destructive">{error}</Text> : null}

          <Pressable
            onPress={handleLogin}
            disabled={submitting}
            className={`mt-2 items-center rounded-xl bg-primary py-3.5 active:opacity-80 ${submitting ? "opacity-50" : ""}`}
          >
            <Text className="font-inter-bold text-base text-primary-foreground">{submitting ? "Accesso…" : "Accedi"}</Text>
          </Pressable>

          <Pressable onPress={() => Alert.alert("Password dimenticata", "Funzionalità in arrivo. Contatta il supporto per reimpostare la password.")} className="items-center py-2 active:opacity-60">
            <Text className="font-inter-semibold text-sm text-primary">Password dimenticata?</Text>
          </Pressable>
        </View>

        <View className="mt-6 flex-row items-center justify-center gap-1">
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
