import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Mail } from "lucide-react-native";
import { Screen } from "@/components/Screen";

/**
 * Registrazione con conferma email attiva: l'account Supabase esiste ma la
 * sessione no, e nella casella di posta sta arrivando il messaggio di
 * conferma. Qui si spiega cosa aspettarsi e come proseguire.
 */
export default function CheckEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();

  return (
    <Screen className="justify-center">
      <View className="flex-1 items-center justify-center gap-6 px-6 py-6">
        <View className="h-20 w-20 items-center justify-center rounded-3xl bg-primary/15">
          <Mail size={36} color="#F97316" strokeWidth={2.2} />
        </View>

        <View className="gap-2">
          <Text className="text-center font-inter-bold text-3xl text-foreground">
            Controlla la tua email
          </Text>
          <Text className="text-center font-sans text-sm leading-5 text-muted">
            Ti sta arrivando un’email di conferma da Supabase
            {email ? (
              <Text className="font-inter-semibold text-foreground"> a {email}</Text>
            ) : null}
            . Clicca il link nel messaggio per attivare il tuo account.
          </Text>
        </View>

        <View className="w-full gap-3">
          <Pressable
            onPress={() => router.replace("/(auth)/login")}
            accessibilityRole="button"
            accessibilityLabel="Ho confermato l'email, vai al login"
            className="items-center rounded-xl bg-primary py-3.5 active:opacity-80 cursor-pointer"
          >
            <Text className="font-inter-bold text-base text-primary-foreground">
              Ho confermato, accedi
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/(auth)/register")}
            accessibilityRole="button"
            accessibilityLabel="Torna alla registrazione"
            className="items-center py-2 active:opacity-60"
          >
            <Text className="font-sans text-sm text-muted">
              Non è arrivata? Riprova a registrarti
            </Text>
          </Pressable>
        </View>

        <Text className="text-center font-sans text-xs leading-4 text-muted">
          Se non la trovi, controlla lo spam: possono volerci qualche minuto.
        </Text>
      </View>
    </Screen>
  );
}
