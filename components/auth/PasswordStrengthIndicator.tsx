import { Text, View } from "react-native";

type Strength = "debole" | "media" | "forte";

function calcStrength(pw: string): { level: Strength; score: number } {
  if (!pw) return { level: "debole", score: 0 };
  let score = 0;
  if (pw.length >= 6) score += 1;
  if (pw.length >= 10) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 2) return { level: "debole", score: 1 };
  if (score <= 3) return { level: "media", score: 2 };
  return { level: "forte", score: 3 };
}

const COLOR: Record<Strength, string> = {
  debole: "#EF4444",
  media: "#F59E0B",
  forte: "#22C55E",
};

const LABEL: Record<Strength, string> = {
  debole: "Debole",
  media: "Media",
  forte: "Forte",
};

export function PasswordStrengthIndicator({ password }: { password: string }) {
  if (!password) return null;
  const { level, score } = calcStrength(password);
  return (
    <View className="gap-1.5">
      <View className="flex-row gap-1.5">
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ backgroundColor: i <= score ? COLOR[level] : "#334155" }}
          />
        ))}
      </View>
      <Text className="font-sans text-xs" style={{ color: COLOR[level] }}>
        Password {LABEL[level]}
      </Text>
    </View>
  );
}

export function getPasswordStrength(password: string): Strength {
  return calcStrength(password).level;
}
