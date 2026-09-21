import { Text, View, Pressable } from "react-native";
import { AuthInput } from "@/components/auth/AuthInput";
import { User, Calendar, Ruler, Weight, VenusAndMars } from "lucide-react-native";

export type PersonalData = {
  name: string;
  age: string;
  gender: "male" | "female" | "other" | "";
  weight: string;
  height: string;
};

type Props = {
  value: PersonalData;
  onChange: (v: PersonalData) => void;
};

const GENDERS: { key: PersonalData["gender"]; label: string }[] = [
  { key: "male", label: "Maschio" },
  { key: "female", label: "Femmina" },
  { key: "other", label: "Altro" },
];

export function PersonalDataStep({ value, onChange }: Props) {
  function set<K extends keyof PersonalData>(k: K, v: PersonalData[K]) {
    onChange({ ...value, [k]: v });
  }

  return (
    <View className="gap-5">
      <Text className="font-inter-bold text-2xl text-foreground">Chi sei?</Text>
      <Text className="font-sans text-sm leading-5 text-muted">Questi dati servono a calcolare il tuo fabbisogno calorico con precisione.</Text>

      <AuthInput
        icon={<User size={16} color="#94A3B8" />}
        placeholder="Nome"
        autoComplete="name"
        value={value.name}
        onChangeText={(t) => set("name", t)}
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <AuthInput
            icon={<Calendar size={16} color="#94A3B8" />}
            placeholder="Età"
            keyboardType="number-pad"
            value={value.age}
            onChangeText={(t) => set("age", t.replace(/[^0-9]/g, ""))}
          />
        </View>
        <View className="flex-1">
          <AuthInput
            icon={<Weight size={16} color="#94A3B8" />}
            placeholder="Peso (kg)"
            keyboardType="decimal-pad"
            value={value.weight}
            onChangeText={(t) => set("weight", t.replace(/[^0-9.,]/g, "").replace(",", "."))}
          />
        </View>
      </View>

      <AuthInput
        icon={<Ruler size={16} color="#94A3B8" />}
        placeholder="Altezza (cm)"
        keyboardType="number-pad"
        value={value.height}
        onChangeText={(t) => set("height", t.replace(/[^0-9]/g, ""))}
      />

      <View className="gap-2">
        <View className="flex-row items-center gap-1.5">
          <VenusAndMars size={14} color="#94A3B8" />
          <Text className="font-inter-semibold text-sm text-foreground">Sesso</Text>
        </View>
        <View className="flex-row gap-2">
          {GENDERS.map((g) => {
            const active = value.gender === g.key;
            return (
              <Pressable
                key={g.key}
                onPress={() => set("gender", g.key)}
                className={`flex-1 items-center rounded-xl border px-3 py-3 active:opacity-80 ${active ? "border-primary bg-primary/15" : "border-border bg-surface"}`}
              >
                <Text className={`font-inter-semibold text-sm ${active ? "text-primary" : "text-muted"}`}>{g.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export function isPersonalDataValid(d: PersonalData): boolean {
  return Boolean(d.name.trim() && d.age && Number(d.age) > 0 && d.gender && d.weight && Number(d.weight) > 0 && d.height && Number(d.height) > 0);
}
