import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Card } from "@/components/home/Card";

export type PersonalData = {
  name: string;
  age: string;
  weightKg: string;
  heightCm: string;
  gender: string;
};

type Props = {
  data: PersonalData;
  readOnly?: boolean;
  onSave: (d: PersonalData) => void;
};

const FIELD_META: { key: keyof PersonalData; label: string; placeholder: string }[] = [
  { key: "name", label: "Nome", placeholder: "Il tuo nome" },
  { key: "age", label: "Età", placeholder: "Es. 28" },
  { key: "weightKg", label: "Peso attuale", placeholder: "Es. 72" },
  { key: "heightCm", label: "Altezza", placeholder: "Es. 175" },
  { key: "gender", label: "Sesso", placeholder: "M / F / Altro" },
];

export function PersonalDataCard({ data, readOnly = false, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PersonalData>(data);

  useEffect(() => {
    setDraft(data);
  }, [data]);

  function handleToggle() {
    if (editing) {
      onSave(draft);
      setEditing(false);
    } else {
      setDraft(data);
      setEditing(true);
    }
  }

  return (
    <Card className="gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-inter-semibold text-base text-foreground">Dati personali</Text>
        {!readOnly ? (
          <Pressable onPress={handleToggle} className={`rounded-full px-4 py-2 active:opacity-80 ${editing ? "bg-primary" : "border border-border bg-background/40"}`}>
            <Text className={`font-inter-semibold text-sm ${editing ? "text-primary-foreground" : "text-muted"}`}>{editing ? "Salva" : "Modifica"}</Text>
          </Pressable>
        ) : null}
      </View>

      <View className="gap-2">
        {FIELD_META.map((f) => {
          const value = draft[f.key];
          return (
            <View key={f.key} className="flex-row items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-3">
              <Text className="w-28 font-sans text-sm text-muted">{f.label}</Text>
              {editing ? (
                <TextInput
                  value={value}
                  onChangeText={(t) => setDraft((p) => ({ ...p, [f.key]: t }))}
                  placeholder={f.placeholder}
                  placeholderTextColor="#64748B"
                  className="flex-1 font-sans text-sm text-foreground"
                />
              ) : (
                <Text className="flex-1 font-inter-semibold text-sm text-foreground">{value?.trim() ? value : "—"}</Text>
              )}
            </View>
          );
        })}
      </View>
    </Card>
  );
}
