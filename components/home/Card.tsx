import { type PropsWithChildren } from "react";
import { View } from "react-native";

type CardProps = PropsWithChildren<{
  className?: string;
}>;

/**
 * Contenitore base delle card della Home: superficie + bordo del tema.
 */
export function Card({ children, className = "" }: CardProps) {
  return (
    <View className={`rounded-2xl border border-border bg-surface p-5 ${className}`}>
      {children}
    </View>
  );
}