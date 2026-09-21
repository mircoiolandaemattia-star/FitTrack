import { useState } from "react";
import { Alert, Platform, Pressable, Switch, Text, View } from "react-native";
import { Card } from "@/components/home/Card";

type Props = {
  readOnly?: boolean;
};

const LANGUAGES = ["Italiano", "English", "Español", "Français"];

export function SettingsCard({ readOnly = false }: Props) {
  const [darkMode, setDarkMode] = useState(true);
  const [notif, setNotif] = useState(false);
  const [lang, setLang] = useState("Italiano");

  async function handleNotifToggle(value: boolean) {
    if (readOnly) return;
    if (!value) {
      setNotif(false);
      return;
    }
    // Web: no permessi nativi, toggle diretto
    if (Platform.OS === "web") {
      setNotif(true);
      return;
    }
    // Su Expo Go SDK 53+ le push remote sono rimosse: evita crash con import dinamico
    try {
      const Notifications = await import("expo-notifications");
      const perm = await Notifications.getPermissionsAsync();
      let status = perm.status;
      if (status !== "granted") {
        const req = await Notifications.requestPermissionsAsync();
        status = req.status;
      }
      if (status !== "granted") {
        Alert.alert("Permesso negato", "Abilita le notifiche dalle impostazioni di sistema.");
        return;
      }
    } catch {
      // Expo Go SDK 53+: modulo rimosso → mock attivo senza crash
      Alert.alert("Expo Go", "Notifiche push non disponibili in Expo Go (SDK 53+). Usa un development build. Attivo in modalità mock.");
    }
    setNotif(true);
  }

  function handleLangPress() {
    if (readOnly) return;
    if (Platform.OS === "web") {
      const next = prompt(`Scegli lingua:\n${LANGUAGES.join(", ")}`, lang);
      if (next && LANGUAGES.includes(next)) setLang(next);
      return;
    }
    Alert.alert("Lingua", "Scegli la lingua", [
      ...LANGUAGES.map((l) => ({ text: l, onPress: () => setLang(l) } as const)),
      { text: "Annulla", style: "cancel" },
    ]);
  }

  return (
    <Card className="gap-4">
      <Text className="font-inter-semibold text-base text-foreground">Impostazioni</Text>

      <View className="flex-row items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-3">
        <Text className="font-sans text-sm text-foreground">Modalità scura</Text>
        <Switch value={darkMode} onValueChange={readOnly ? undefined : setDarkMode} disabled={readOnly} trackColor={{ true: "#F97316" }} thumbColor="#fff" />
      </View>

      <View className="flex-row items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-3">
        <Text className="font-sans text-sm text-foreground">Notifiche</Text>
        <Switch value={notif} onValueChange={handleNotifToggle} disabled={readOnly} trackColor={{ true: "#F97316" }} thumbColor="#fff" />
      </View>

      <Pressable
        disabled={readOnly}
        onPress={handleLangPress}
        className={`flex-row items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-3 active:opacity-80 ${readOnly ? "opacity-60" : ""}`}
      >
        <Text className="font-sans text-sm text-muted">Lingua</Text>
        <Text className="font-inter-semibold text-sm text-foreground">{lang} ›</Text>
      </Pressable>
    </Card>
  );
}
