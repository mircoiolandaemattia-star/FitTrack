import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import { FitTrackTabBar } from "../../components/navigation/FitTrackTabBar";

/**
 * Tab bar per piattaforma:
 * - iOS (26+): Liquid Glass nativa (NativeTabs, SF Symbols) — funziona bene.
 * - Android:   barra JS stile Material 3 (FitTrackTabBar + icone Lucide).
 *              Sostituisce i tab nativi perché le icone Material di NativeTabs
 *              non si vedono sulla tab attiva (StateListDrawable di
 *              react-native-screens non renderizza lo stato selezionato).
 * - Web:       stessa barra JS del Design System (tema scuro).
 *
 * Tinta selezione: arancione energia del design system.
 */
export default function TabsLayout() {
  if (Platform.OS === "ios") {
    return <NativeTabsLayout />;
  }
  return <MaterialTabs />;
}

/** Sfondo scuro forzato a tutti i livelli nativi dei tab (iOS). */
const NATIVE_TABS_BG = { backgroundColor: "#0F172A" };

/**
 * Tab bar JS riprogettata (Android + Web): pill Material 3, icone Lucide,
 * etichette sempre visibili, safe area e target >= 48pt gestiti nel componente.
 */
function MaterialTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#0F172A" },
      }}
      tabBar={FitTrackTabBarWrapper}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="scheda" options={{ title: "Scheda" }} />
      <Tabs.Screen name="dieta" options={{ title: "Dieta" }} />
      <Tabs.Screen name="progressi" options={{ title: "Progressi" }} />
      <Tabs.Screen name="profilo" options={{ title: "Profilo" }} />
    </Tabs>
  );
}

/**
 * Wrapper a identità stabile per la `tabBar`.
 * Il fork di bottom-tabs di expo-router invoca `tabBar` come render-prop
 * (`tabBar({ state, descriptors, navigation, insets })`, vedi BottomTabView):
 * passandogli direttamente un componente con hook (FitTrackTabBar) lo chiama
 * come funzione piana da DOM-fuori-dalla-render-phase → "Invalid hook call".
 * Restituendo JSX (`<FitTrackTabBar ... />`) React lo monta come componente
 * regolare. Definita a livello di modulo per non cambiare identità a ogni
 * render (evita il remount della barra).
 */
function FitTrackTabBarWrapper(props: BottomTabBarProps) {
  return <FitTrackTabBar {...props} />;
}

/** Tab bar nativa per iOS (Liquid Glass). */
function NativeTabsLayout() {
  return (
    <NativeTabs
      tintColor="#F97316"
      iconColor={{ default: "#64748B", selected: "#F97316" }}
      labelStyle={{ fontSize: 12 }}
      // Il container nativo usa per default lo sfondo di sistema (bianco in
      // modalità chiara): lo forziamo al colore del tema per non vedere
      // bianco dietro la tab bar Liquid Glass.
      unstable_nativeProps={{ nativeContainerStyle: NATIVE_TABS_BG }}
    >
      <NativeTabs.Trigger name="home" contentStyle={NATIVE_TABS_BG}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="scheda" contentStyle={NATIVE_TABS_BG}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "dumbbell", selected: "dumbbell.fill" }}
        />
        <NativeTabs.Trigger.Label>Scheda</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="dieta" contentStyle={NATIVE_TABS_BG}>
        <NativeTabs.Trigger.Icon sf="fork.knife" />
        <NativeTabs.Trigger.Label>Dieta</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="progressi" contentStyle={NATIVE_TABS_BG}>
        <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" />
        <NativeTabs.Trigger.Label>Progressi</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profilo" contentStyle={NATIVE_TABS_BG}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "person", selected: "person.fill" }}
        />
        <NativeTabs.Trigger.Label>Profilo</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}