import { View, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { Screen } from "./Screen";

type PlaceholderScreenProps = {
  title: string;
  subtitle?: string;
  Icon?: LucideIcon;
};

/**
 * Schermata segnaposto: titolo centrato + icona + eventuale sottotitolo.
 * Verrà sostituita dalle schermate reali nelle prossime iterazioni.
 */
export function PlaceholderScreen({ title, subtitle, Icon }: PlaceholderScreenProps) {
  return (
    <Screen className="items-center justify-center px-6">
      <View className="items-center gap-4">
        {Icon ? (
          <View className="h-20 w-20 items-center justify-center rounded-3xl bg-primary/15">
            <Icon size={36} color="#F97316" strokeWidth={2.2} />
          </View>
        ) : null}
        <Text className="font-inter-bold text-4xl text-foreground">{title}</Text>
        {subtitle ? (
          <Text className="max-w-xs text-center font-sans text-base leading-6 text-muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}