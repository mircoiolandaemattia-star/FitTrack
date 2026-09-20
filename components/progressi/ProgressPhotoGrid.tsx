import { Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImageIcon, Plus } from "lucide-react-native";
import type { ProgressPhoto } from "@/types";

type Props = {
  photos: ProgressPhoto[];
  onAdd: (uri: string) => void;
  readOnly?: boolean;
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ProgressPhotoGrid({ photos, onAdd, readOnly = false }: Props) {
  async function handlePick() {
    if (readOnly) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (!cam.granted) return;
        const res = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [3, 4] });
        if (!res.canceled && res.assets[0]) onAdd(res.assets[0].uri);
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [3, 4] });
      if (!res.canceled && res.assets[0]) onAdd(res.assets[0].uri);
    } catch {}
  }

  if (photos.length === 0) {
    return (
      <Pressable
        onPress={handlePick}
        disabled={readOnly}
        className={`items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background/20 py-10 active:opacity-80 ${readOnly ? "opacity-60" : ""}`}
      >
        <View className="h-12 w-12 items-center justify-center rounded-full bg-surface">
          <ImageIcon size={22} color="#64748B" strokeWidth={2.2} />
        </View>
        <Text className="font-inter-semibold text-sm text-foreground">Aggiungi la tua prima foto progresso</Text>
        <Text className="font-sans text-xs text-muted">Tocca per scattare o scegliere dalla galleria</Text>
      </Pressable>
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-3">
        {photos.map((p) => (
          <View key={p.id} className="w-[48%] gap-1.5">
            <View className="overflow-hidden rounded-2xl border border-border bg-background/40">
              <Image source={{ uri: p.photoUrl }} style={{ width: "100%", aspectRatio: 3 / 4 }} resizeMode="cover" />
            </View>
            <Text className="font-sans text-xs text-muted">{formatDate(p.takenAt)}</Text>
          </View>
        ))}
      </View>
      {!readOnly ? (
        <Pressable onPress={handlePick} className="flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-background/20 py-3 active:opacity-80">
          <Plus size={16} color="#94A3B8" strokeWidth={2.2} />
          <Camera size={16} color="#94A3B8" strokeWidth={2.2} />
          <Text className="font-inter-semibold text-sm text-muted">Aggiungi foto</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
