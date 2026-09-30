import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { Camera, ImageIcon, Plus } from "lucide-react-native";
import type { ProgressPhoto } from "@/types";

type Props = {
  photos: ProgressPhoto[];
  /** Caricamento in corso su Supabase Storage: disattiva il ripremere. */
  uploading?: boolean;
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
 * Griglia foto progressi: le foto arrivano da `GET /api/progress-photos`
 * con URL firmati già risolti, e "Aggiungi" apre il picker (fotocamera o
 * galleria) per caricare una nuova immagine sul bucket privato.
 */
export function ProgressPhotoGrid({ photos, onAdd, uploading = false, readOnly = false }: Props) {
  if (photos.length === 0) {
    return (
      <Pressable
        onPress={onAdd}
        disabled={readOnly || uploading}
        className={`items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background/20 py-10 active:opacity-80 ${readOnly ? "opacity-60" : ""}`}
      >
        <View className="h-12 w-12 items-center justify-center rounded-full bg-surface">
          {uploading ? (
            <ActivityIndicator size="small" color="#F97316" />
          ) : (
            <ImageIcon size={22} color="#64748B" strokeWidth={2.2} />
          )}
        </View>
        <Text className="font-inter-semibold text-sm text-foreground">
          {uploading ? "Caricamento in corso…" : "Nessuna foto progresso"}
        </Text>
        {!uploading ? (
          <Text className="font-sans text-xs text-muted">Tocca per aggiungerne una</Text>
        ) : null}
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
        <Pressable
          onPress={onAdd}
          disabled={uploading}
          className="flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-background/20 py-3 active:opacity-80"
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#F97316" />
          ) : (
            <>
              <Plus size={16} color="#94A3B8" strokeWidth={2.2} />
              <Camera size={16} color="#94A3B8" strokeWidth={2.2} />
            </>
          )}
          <Text className="font-inter-semibold text-sm text-muted">
            {uploading ? "Caricamento…" : "Aggiungi foto"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
