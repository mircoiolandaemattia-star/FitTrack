import { NativeTabs } from "expo-router/unstable-native-tabs";

/**
 * Tab bar NATIVA per piattaforma:
 * - iOS (26+): Liquid Glass (sf = SF Symbols)
 * - Android:    Material 3 (md = icone Material)
 * - Web:        fallback JS (Radix) con le etichette
 *
 * Tinta selezione: arancione energia del design system.
 */
export default function TabsLayout() {
  return (
    <NativeTabs
      tintColor="#F97316"
      iconColor={{ default: "#64748B", selected: "#F97316" }}
      labelStyle={{ fontSize: 12 }}
      indicatorColor="#F97316"
      rippleColor="rgba(249, 115, 22, 0.25)"
    >
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md={{ default: "home", selected: "home_filled" }}
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="scheda">
        <NativeTabs.Trigger.Icon
          sf={{ default: "dumbbell", selected: "dumbbell.fill" }}
          md={{ default: "fitness_center", selected: "fitness_center" }}
        />
        <NativeTabs.Trigger.Label>Scheda</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="dieta">
        <NativeTabs.Trigger.Icon
          sf={{ default: "fork.knife", selected: "fork.knife" }}
          md={{ default: "restaurant", selected: "restaurant" }}
        />
        <NativeTabs.Trigger.Label>Dieta</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="progressi">
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis" }}
          md={{ default: "trending_up", selected: "trending_up" }}
        />
        <NativeTabs.Trigger.Label>Progressi</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profilo">
        <NativeTabs.Trigger.Icon
          sf={{ default: "person", selected: "person.fill" }}
          md={{ default: "person", selected: "person" }}
        />
        <NativeTabs.Trigger.Label>Profilo</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}