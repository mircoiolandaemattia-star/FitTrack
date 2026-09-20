import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, Image as ImageIcon, Sparkles } from "lucide-react-native";
import type { DietFoodDraft } from "@/types";
import { FreeLimitBanner } from "./FreeLimitBanner";
import { incrementMockFotoUsateOggi, mockAnalyzePhoto, MOCK_FOTO_LIMITE_GIORNALIERO, MOCK_FOTO_USATE_OGGI } from "@/lib/dietaStore";

const EXAMPLE_CHIPS = ["Pasta al pomodoro", "Petto di pollo con verdure", "Insalata con tonno"];

type PhotoRecognitionFlowProps = {
  onAdd: (draft: DietFoodDraft) => void;
  isPremium: boolean;
};

export function PhotoRecognitionFlow({ onAdd, isPremium }: PhotoRecognitionFlowProps) {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState<"form" | "loading" | "result">("form");
  const [result, setResult] = useState<DietFoodDraft | null>(null);

  const limitReached = !isPremium && MOCK_FOTO_USATE_OGGI >= MOCK_FOTO_LIMITE_GIORNALIERO;

  async function pickImage(useCamera: boolean) {
    try {
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        const res = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
        if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
      } else {
        const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true });
        if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
      }
    } catch {}
  }

  function handleAnalyze() {
    if (!description.trim()) return;
    setPhase("loading");
    setTimeout(() => {
      const mock = mockAnalyzePhoto(description);
      // Personalizza nome con descrizione
      mock.name = description.trim().slice(0, 40);
      setResult(mock);
      setPhase("result");
    }, 1800);
  }

  function handleConfirm() {
    if (!result) return;
    incrementMockFotoUsateOggi();
    onAdd(result);
  }

  if (limitReached && phase === "form") {
    return (
      <View className="gap-4">
        <FreeLimitBanner used={MOCK_FOTO_USATE_OGGI} limit={MOCK_FOTO_LIMITE_GIORNALIERO} />
      </View>
    );
  }

  if (phase === "loading") {
    return (
      <View className="items-center gap-3 py-10">
        <ActivityIndicator size="large" color="#F97316" />
        <Text className="font-inter-semibold text-base text-foreground">L'AI sta analizzando il pasto...</Text>
        <Text className="text-center font-sans text-sm text-muted">Stima di ingredienti e quantità in corso</Text>
      </View>
    );
  }

  if (phase === "result" && result) {
    return (
      <ScrollView contentContainerClassName="gap-4">
        <Text className="font-inter-semibold text-base text-foreground">Risultato (modificabile)</Text>
        <View className="gap-3 rounded-xl border border-border bg-background/40 p-4">
          <View>
            <Text className="font-sans text-xs text-muted">Nome</Text>
            <TextInput value={result.name} onChangeText={(t) => setResult({ ...result, name: t })} className="mt-1 rounded-lg border border-border bg-surface px-3 py-2.5 font-sans text-sm text-foreground" placeholderTextColor="#64748B" />
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Text className="font-sans text-xs text-muted">Quantità (g)</Text>
              <TextInput value={String(result.quantityG)} onChangeText={(t) => setResult({ ...result, quantityG: parseInt(t) || 0 })} keyboardType="numeric" className="mt-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-center font-sans text-sm text-foreground" placeholderTextColor="#64748B" />
            </View>
            <View className="flex-1">
              <Text className="font-sans text-xs text-muted">Calorie</Text>
              <TextInput value={String(result.calories)} onChangeText={(t) => setResult({ ...result, calories: parseInt(t) || 0 })} keyboardType="numeric" className="mt-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-center font-sans text-sm text-foreground" placeholderTextColor="#64748B" />
            </View>
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Text className="font-sans text-xs text-muted">Proteine (g)</Text>
              <TextInput value={String(result.proteinG)} onChangeText={(t) => setResult({ ...result, proteinG: parseFloat(t.replace(",", ".")) || 0 })} keyboardType="numeric" className="mt-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-center font-sans text-sm text-foreground" placeholderTextColor="#64748B" />
            </View>
            <View className="flex-1">
              <Text className="font-sans text-xs text-muted">Carbo (g)</Text>
              <TextInput value={String(result.carbsG)} onChangeText={(t) => setResult({ ...result, carbsG: parseFloat(t.replace(",", ".")) || 0 })} keyboardType="numeric" className="mt-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-center font-sans text-sm text-foreground" placeholderTextColor="#64748B" />
            </View>
            <View className="flex-1">
              <Text className="font-sans text-xs text-muted">Grassi (g)</Text>
              <TextInput value={String(result.fatsG)} onChangeText={(t) => setResult({ ...result, fatsG: parseFloat(t.replace(",", ".")) || 0 })} keyboardType="numeric" className="mt-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-center font-sans text-sm text-foreground" placeholderTextColor="#64748B" />
            </View>
          </View>
        </View>
        <Pressable onPress={handleConfirm} className="flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3.5 active:opacity-80">
          <Sparkles size={18} color="#0F172A" strokeWidth={2.2} />
          <Text className="font-inter-bold text-base text-primary-foreground">Conferma e aggiungi</Text>
        </Pressable>
        <Pressable onPress={() => setPhase("form")} className="items-center rounded-xl border border-border bg-background/60 py-3 active:opacity-80">
          <Text className="font-inter-semibold text-sm text-muted">Torna indietro</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4">
      <View className="flex-row gap-2">
        <Pressable onPress={() => pickImage(true)} className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-background/40 py-3 active:opacity-80">
          <Camera size={18} color="#F97316" strokeWidth={2.2} />
          <Text className="font-inter-semibold text-sm text-foreground">Fotocamera</Text>
        </Pressable>
        <Pressable onPress={() => pickImage(false)} className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-background/40 py-3 active:opacity-80">
          <ImageIcon size={18} color="#94A3B8" strokeWidth={2.2} />
          <Text className="font-inter-semibold text-sm text-muted">Galleria</Text>
        </Pressable>
      </View>

      {photoUri ? (
        <View className="overflow-hidden rounded-2xl border border-border bg-background/40">
          <Image source={{ uri: photoUri }} style={{ width: "100%", height: 180 }} resizeMode="cover" />
        </View>
      ) : (
        <View className="items-center rounded-2xl border-2 border-dashed border-border bg-background/20 py-8">
          <ImageIcon size={24} color="#64748B" strokeWidth={2.2} />
          <Text className="mt-2 font-sans text-sm text-muted">Nessuna foto selezionata (opzionale)</Text>
        </View>
      )}

      <View className="gap-2">
        <Text className="font-inter-semibold text-sm text-foreground">Descrizione *</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Descrivi gli ingredienti e la preparazione (es. petto di pollo alla griglia con riso e verdure)"
          placeholderTextColor="#64748B"
          multiline
          numberOfLines={3}
          className="min-h-[80px] rounded-xl border border-border bg-surface px-3 py-3 font-sans text-sm leading-5 text-foreground"
          textAlignVertical="top"
        />
        <Text className="font-sans text-xs leading-4 text-muted">Descrivi gli ingredienti, l'AI stimerà le quantità dalla foto</Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {EXAMPLE_CHIPS.map((chip) => (
          <Pressable key={chip} onPress={() => setDescription(chip)} className="rounded-full border border-border bg-surface px-3 py-2 active:opacity-80">
            <Text className="font-sans text-xs text-muted">{chip}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={handleAnalyze}
        disabled={!description.trim()}
        className={`flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${!description.trim() ? "bg-primary/40 opacity-60" : "bg-primary active:opacity-80"}`}
      >
        <Sparkles size={18} color="#0F172A" strokeWidth={2.2} />
        <Text className="font-inter-bold text-base text-primary-foreground">Analizza con AI</Text>
      </Pressable>

      {!isPremium ? (
        <Text className="text-center font-sans text-xs text-muted">Foto usate oggi: {MOCK_FOTO_USATE_OGGI}/{MOCK_FOTO_LIMITE_GIORNALIERO}</Text>
      ) : null}
    </ScrollView>
  );
}
