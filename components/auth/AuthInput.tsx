import { useState } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

type Props = Omit<TextInputProps, "style"> & {
  icon?: React.ReactNode;
  error?: boolean;
  errorMessage?: string;
  isPassword?: boolean;
};

export function AuthInput({ icon, error, errorMessage, isPassword, secureTextEntry, ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  const isSecure = isPassword ? !visible && secureTextEntry !== false : secureTextEntry;

  return (
    <View className="gap-1.5">
      <View
        className={`flex-row items-center gap-3 rounded-xl border bg-surface px-4 py-1 ${
          error ? "border-destructive bg-destructive/10" : "border-border"
        }`}
      >
        {icon ? <View className="opacity-60">{icon}</View> : null}
        <TextInput
          {...rest}
          secureTextEntry={isSecure}
          placeholderTextColor="#64748B"
          className="flex-1 py-3.5 font-sans text-[15px] leading-5 text-foreground"
          style={{ flex: 1 }}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={visible ? "Nascondi password" : "Mostra password"}
            className="p-1"
          >
            {visible ? <EyeOff size={18} color="#94A3B8" /> : <Eye size={18} color="#94A3B8" />}
          </Pressable>
        ) : null}
      </View>
      {error && errorMessage ? <Text className="px-1 font-sans text-xs text-destructive">{errorMessage}</Text> : null}
    </View>
  );
}
