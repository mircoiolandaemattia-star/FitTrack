import { Platform, StyleSheet, type ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import {
  Dumbbell,
  Home,
  TrendingUp,
  User,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react-native";

/**
 * Tab bar per piattaforma:
 * - iOS (26+): Liquid Glass nativa (NativeTabs, SF Symbols) — funziona bene.
 * - Android:   barra classica del web (variante 'uikit' della BottomTabBar
 *              di expo-router): icona Lucide + etichetta, tinta arancione
 *              attiva / grigia inattiva. Sostituisce i tab nativi perché le
 *              icone Material di NativeTabs non si vedono sulla tab attiva
 *              (StateListDrawable di react-native-screens non renderizza lo
 *              stato selezionato).
 * - Web:       stessa barra classica del Design System (tema scuro).
 *
 * NB: la variante 'material' del fork è disponibile solo con
 * `tabBarPosition` 'left'/'right' (layout verticali): per una barra in basso
 * si usa la 'uikit' classica. Niente componente `tabBar` custom: il fork lo
 * invoca come render-prop con chiamata di funzione diretta → "Invalid hook
 * call" con componenti React (testato anche via wrapper).
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

/** Colori del design system FitTrack (dark-only). */
const BAR_BG = "#0F172A";
const BAR_BORDER = "#1E293B";
const TAB_ACTIVE = "#F97316";
const TAB_INACTIVE = "#94A3B8";
const ICON_STROKE = 2.2;

type TabIconProps = { focused: boolean; color: ColorValue; size: number };

/** Render prop `tabBarIcon` a identità stabile (definita a livello di modulo). */
const renderTabIcon =
  (Icon: LucideIcon) =>
  ({ color, size }: TabIconProps) =>
    <Icon size={size} color={color as string} strokeWidth={ICON_STROKE} />;

/**
 * Barra JS classica del web (Android + Web), tutta via opzioni supportate
 * della BottomTabBar del fork (variante 'uikit' di default): icona + 
 * etichetta, tint arancione attiva / grigia inattiva, barra scura con
 * hairline superiore, safe area gestita dal fork.
 */
function MaterialTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: BAR_BG },
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarStyle: {
          backgroundColor: BAR_BG,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: BAR_BORDER,
        },
        tabBarLabelStyle: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home", tabBarIcon: renderTabIcon(Home) }}
      />
      <Tabs.Screen
        name="scheda"
        options={{ title: "Scheda", tabBarIcon: renderTabIcon(Dumbbell) }}
      />
      <Tabs.Screen
        name="dieta"
        options={{ title: "Dieta", tabBarIcon: renderTabIcon(UtensilsCrossed) }}
      />
      <Tabs.Screen
        name="progressi"
        options={{ title: "Progressi", tabBarIcon: renderTabIcon(TrendingUp) }}
      />
      <Tabs.Screen
        name="profilo"
        options={{ title: "Profilo", tabBarIcon: renderTabIcon(User) }}
      />
    </Tabs>
  );
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