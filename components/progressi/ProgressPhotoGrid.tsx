import { Image, Pressable, Text, View } from "react-native";
import { Camera, ImageIcon, Plus } from "lucide-react-native";
import type { ProgressPhoto } from "@/types";

type Props = {
  photos: ProgressPhoto[];
  /** L'upload è ancora stub (serve Supabase Storage): notifica la schermata. */
  onAdd: () => void;
  readOnly?: boolean;
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Griglia foto progressi: le foto arrivano da `GET /api/progress-photos`.
 * Il picker non è più collegato: premere "Aggiungi" notifica la schermata
 * che l'upload resta uno stub (richiede Supabase Storage).
 */
export function ProgressPhotoGrid({ photos, onAdd, readOnly = false }: Props) {
  if (photos.length === 0) {
    return (
      <Pressable
        onPress={onAdd}
        disabled={readOnly}
        className={`items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background/20 py-10 active:opacity-80 ${readOnly ? "opacity-60" : ""}`}
      >
        <View className="h-12 w-12 items-center justify-center rounded-full bg-surface">
          <ImageIcon size={22} color="#64748B" strokeWidth={2.2} />
        </View>
        <Text className="font-inter-semibold text-sm text-foreground">Nessuna foto progresso</Text>
        <Text className="font-sans text-xs text-muted">Tocca per aggiungerne una</Text>
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
        <Pressable onPress={onAdd} className="flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-background/20 py-3 active:opacity-80">
          <Plus size={16} color="#94A3B8" strokeWidth={2.2} />
          <Camera size={16} color="#94A3B8" strokeWidth={2.2} />
          <Text className="font-inter-semibold text-sm text-muted">Aggiungi foto</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
