import { type PropsWithChildren } from "react";
import { type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ScreenProps = PropsWithChildren<{
  /** Classi NativeWind applicate al contenitore. */
  className?: string;
  testID?: ViewProps["testID"];
}>;

/**
 * Schermata base: sfondo del tema e rispetto delle safe area
 * (top/laterali; il fondo è gestito da tab bar e pulsanti).
 */
export function Screen({ children, className, testID }: ScreenProps) {
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      testID={testID}
      className={`flex-1 bg-background ${className ?? ""}`}
    >
      {children}
    </SafeAreaView>
  );
}