import { useState } from "react";
import { Alert, Platform, Pressable, Switch, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
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
    if (value) {
      try {
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
        // su web expo-notifications può non essere disponibile: mock ok
      }
    }
    setNotif(value);
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
