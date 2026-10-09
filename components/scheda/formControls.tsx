import type { ReactNode } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";

/**
 * Controlli del form della scheda (creazione e modifica del giorno):
 * porzioni di UI senza logica, estratti da `CreateWorkoutModal` così i due
 * form restano identici in aspetto e accessibilità.
 */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="font-inter-semibold text-sm text-foreground">{title}</Text>
      {children}
    </View>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`cursor-pointer rounded-full border px-4 py-2.5 active:opacity-80 ${
        selected ? "border-primary bg-primary/15" : "border-border bg-surface"
      }`}
    >
      <Text
        className={`font-inter-semibold text-sm ${selected ? "text-primary" : "text-muted"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function NumberField({
  label,
  value,
  onChangeText,
  accessibilityLabel,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  accessibilityLabel?: string;
}) {
  return (
    <View className="flex-1">
      <Text className="mb-1 font-sans text-xs text-muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
        accessibilityLabel={accessibilityLabel ?? label}
        placeholder="0"
        placeholderTextColor="#64748B"
        className="rounded-lg border border-border bg-surface px-3 py-2 text-center font-sans text-foreground"
      />
    </View>
  );
}

/** Campo di testo etichettato (nome del giorno, note dell'esercizio). */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  numberOfLines = 1,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  numberOfLines?: number;
  /** Limite di caratteri: allineato al massimo accettato dal backend. */
  maxLength?: number;
}) {
  return (
    <View className="flex-1">
      <Text className="mb-1 font-sans text-xs text-muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#64748B"
        multiline={numberOfLines > 1}
        maxLength={maxLength}
        accessibilityLabel={accessibilityLabel ?? label}
        className={`rounded-lg border border-border bg-surface px-3 py-2 font-sans text-foreground ${
          numberOfLines > 1 ? "min-h-[64px] text-top" : ""
        }`}
      />
    </View>
  );
}

export function IconButton({
  onPress,
  disabled = false,
  destructive = false,
  accessibilityLabel,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  accessibilityLabel: string;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={`h-11 w-11 cursor-pointer items-center justify-center rounded-lg active:opacity-80 ${
        disabled ? "opacity-30" : destructive ? "bg-destructive/15" : "bg-background/60"
      }`}
    >
      {children}
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`flex-row cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-3.5 active:opacity-80 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      {icon}
      <Text className="font-inter-bold text-base text-primary-foreground">{label}</Text>
    </Pressable>
  );
}
