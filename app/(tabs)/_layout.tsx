import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Home, Dumbbell, UtensilsCrossed, TrendingUp, User } from "lucide-react-native";

/**
 * Tab bar per piattaforma:
 * - iOS (26+): Liquid Glass nativa (sf = SF Symbols)
 * - Android:   Material 3 nativa (md = icone Material)
 * - Web:       Tabs classica in basso, tema scuro (niente pill
 *              flottante che copre l'header e testo illeggibile)
 *
 * Tinta selezione: arancione energia del design system.
 */
export default function TabsLayout() {
  if (Platform.OS === "web") {
    return <WebTabs />;
  }
  return <NativeTabsLayout />;
}

const WEB_TAB_ICON_SIZE = 22;
const WEB_ACTIVE_TINT = "#F97316";
const WEB_INACTIVE_TINT = "#94A3B8";

/** Sfondo scuro forzato a tutti i livelli nativi dei tab. */
const NATIVE_TABS_BG = { backgroundColor: "#0F172A" };

/** Barra tab per web: in basso, sfondo scuro, etichette sempre leggibili. */
function WebTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#0F172A" },
        tabBarStyle: {
          backgroundColor: "#0F172A",
          borderTopColor: "#1E293B",
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: WEB_ACTIVE_TINT,
        tabBarInactiveTintColor: WEB_INACTIVE_TINT,
        tabBarLabelStyle: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Home size={WEB_TAB_ICON_SIZE} color={color} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="scheda"
        options={{
          title: "Scheda",
          tabBarIcon: ({ color }) => (
            <Dumbbell size={WEB_TAB_ICON_SIZE} color={color} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="dieta"
        options={{
          title: "Dieta",
          tabBarIcon: ({ color }) => (
            <UtensilsCrossed size={WEB_TAB_ICON_SIZE} color={color} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="progressi"
        options={{
          title: "Progressi",
          tabBarIcon: ({ color }) => (
            <TrendingUp size={WEB_TAB_ICON_SIZE} color={color} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profilo"
        options={{
          title: "Profilo",
          tabBarIcon: ({ color }) => (
            <User size={WEB_TAB_ICON_SIZE} color={color} strokeWidth={2.2} />
          ),
        }}
      />
    </Tabs>
  );
}

/** Tab bar nativa per iOS (Liquid Glass) e Android (Material 3). */
function NativeTabsLayout() {
  return (
    <NativeTabs
      tintColor="#F97316"
      iconColor={{ default: "#64748B", selected: "#F97316" }}
      labelStyle={{ fontSize: 12 }}
      indicatorColor="#F97316"
      rippleColor="rgba(249, 115, 22, 0.25)"
      // Il container nativo usa per default lo sfondo di sistema (bianco in
      // modalità chiara): lo forziamo al colore del tema per non vedere
      // bianco dietro la tab bar Liquid Glass / Material.
      unstable_nativeProps={{ nativeContainerStyle: NATIVE_TABS_BG }}
    >
      <NativeTabs.Trigger name="home" contentStyle={NATIVE_TABS_BG}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md={{ default: "home", selected: "home_filled" }}
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="scheda" contentStyle={NATIVE_TABS_BG}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "dumbbell", selected: "dumbbell.fill" }}
          md={{ default: "fitness_center", selected: "fitness_center" }}
        />
        <NativeTabs.Trigger.Label>Scheda</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="dieta" contentStyle={NATIVE_TABS_BG}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "fork.knife", selected: "fork.knife" }}
          md={{ default: "restaurant", selected: "restaurant" }}
        />
        <NativeTabs.Trigger.Label>Dieta</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="progressi" contentStyle={NATIVE_TABS_BG}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis" }}
          md={{ default: "trending_up", selected: "trending_up" }}
        />
        <NativeTabs.Trigger.Label>Progressi</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profilo" contentStyle={NATIVE_TABS_BG}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "person", selected: "person.fill" }}
          md={{ default: "person", selected: "person" }}
        />
        <NativeTabs.Trigger.Label>Profilo</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}