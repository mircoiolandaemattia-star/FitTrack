import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import {
  Dumbbell,
  Home,
  TrendingUp,
  User,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react-native";

/**
 * Tab bar JS con look Material 3, usata su Android e Web.
 *
 * Motivazione: le icone native Material di NativeTabs su Android passano per
 * `renderToImageAsync` + `StateListDrawable` di react-native-screens, che non
 * renderizza l'icona sullo stato selezionato. Una barra JS con icone Lucide
 * elimina quella classe di bug e dà il pieno controllo del design (pill attiva,
 * ripple, safe area, contrasto). Su iOS resta la tab bar nativa Liquid Glass.
 *
 * Le props sono quelle del fork di bottom-tabs di expo-router:
 * { state, descriptors, navigation, insets }.
 *
 * Design (design-system/fittrack + Material 3):
 * - max 5 tab, etichetta sempre visibile
 * - stato attivo: pill arancione (secondaryContainer) + icona/etichetta #F97316
 * - stato inattivo: icona/etichetta #94A3B8 (contrasto > 4.5:1 su #0F172A)
 * - target touch >= 48dp, feedback ripple android, cursor pointer + focus su web
 * - nessun emoji, famiglia icone unica (Lucide, outline, stesso stroke)
 */
export function FitTrackTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  return (
    <View
      style={[
        styles.bar,
        { height: BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.itemsRow} role="tablist">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          return (
            <TabItem
              key={route.key}
              routeName={route.name}
              label={label}
              isFocused={isFocused}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

/** Singolo articolo della barra (stato focus gestito localmente per il web). */
function TabItem({
  routeName,
  label,
  isFocused,
  accessibilityLabel,
  testID,
  onPress,
  onLongPress,
}: {
  routeName: string;
  label: string;
  isFocused: boolean;
  accessibilityLabel?: string;
  testID?: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const Icon = TAB_ICONS[routeName] ?? Home;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      android_ripple={{ color: RIPPLE }}
      style={({ pressed }) => [
        styles.item,
        pressed ? styles.itemPressed : null,
        Platform.OS === "web" ? styles.itemWeb : null,
        Platform.OS === "web" && focused ? styles.itemWebFocused : null,
      ]}
    >
      <View style={[styles.iconZone, isFocused ? styles.iconZoneActive : null]}>
        <Icon
          size={ICON_SIZE}
          color={isFocused ? ICON_ACTIVE : ICON_INACTIVE}
          strokeWidth={ICON_STROKE}
        />
      </View>
      <Text
        numberOfLines={1}
        style={[styles.label, isFocused ? styles.labelActive : styles.labelInactive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Colori del design system FitTrack (dark-only). */
const BAR_BG = "#0F172A";
const BAR_BORDER = "#1E293B";
const ICON_ACTIVE = "#F97316";
const ICON_INACTIVE = "#94A3B8";
const LABEL_ACTIVE = "#F97316";
const LABEL_INACTIVE = "#94A3B8";
/** Pill "secondaryContainer" dell'item attivo (arancione al 14%). */
const PILL_BG = "rgba(249, 115, 22, 0.14)";
const RIPPLE = "rgba(249, 115, 22, 0.18)";

const BAR_HEIGHT = 64;
const ICON_SIZE = 24;
const ICON_STROKE = 2.2;
const PILL_WIDTH = 64;
const PILL_HEIGHT = 32;
const PILL_RADIUS = 16;

const TAB_ICONS: Record<string, LucideIcon> = {
  home: Home,
  scheda: Dumbbell,
  dieta: UtensilsCrossed,
  progressi: TrendingUp,
  profilo: User,
};

const styles = StyleSheet.create({
  bar: {
    backgroundColor: BAR_BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BAR_BORDER,
  },
  itemsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: 48,
  },
  itemPressed: {
    opacity: 0.7,
  },
  itemWeb: {
    cursor: "pointer",
  },
  itemWebFocused: {
    outlineStyle: "solid",
    outlineWidth: 2,
    outlineColor: ICON_ACTIVE,
    outlineOffset: -2,
  },
  iconZone: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  iconZoneActive: {
    backgroundColor: PILL_BG,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  labelActive: {
    color: LABEL_ACTIVE,
  },
  labelInactive: {
    color: LABEL_INACTIVE,
  },
});