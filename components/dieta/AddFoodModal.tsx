import { useState } from "react";
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Barcode, Camera, Check, FileText, Images, PenLine, Sparkles, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import type { DietFoodDraft } from "@/types";
import type { MealType } from "@/lib/dietaStore";
import { aiErrorMessage, useAnalyzeMealPhoto, type AiFoodItem } from "@/lib/aiQueries";
import { ManualFoodForm } from "./ManualFoodForm";

type AddMode = "menu" | "photo" | "barcode" | "manual" | "upload";

/** Provenienza degli alimenti: diventa `food_items.source`. */
export type FoodSource = "manual" | "photo";

type AddFoodModalProps = {
  visible: boolean;
  mealType: MealType | null;
  onClose: () => void;
  /** Un solo salvataggio per ogni conferma (foto = più alimenti insieme). */
  onAdd: (drafts: DietFoodDraft[], source: FoodSource) => void;
};

const MODE_TITLES: Record<AddMode, string> = {
  menu: "Aggiungi alimento",
  photo: "Foto + AI",
  barcode: "Scansiona codice a barre",
  manual: "Inserimento manuale",
  upload: "Carica dieta esistente",
};

/** Foto scelta o scattata, con il base64 pronto per il backend. */
type PickedPhoto = { uri: string; data: string; mimeType: string };

function MenuOption({ icon, title, description, onPress }: { icon: React.ReactNode; title: string; description: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 rounded-2xl border border-border bg-background/40 p-4 active:opacity-80">
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-surface">{icon}</View>
      <View className="flex-1">
        <Text className="font-inter-semibold text-base text-foreground">{title}</Text>
        <Text className="mt-0.5 font-sans text-sm leading-5 text-muted">{description}</Text>
      </View>
    </Pressable>
  );
}

/** Pannello delle modalità non ancora collegate: stesso trattamento degli stub di Scheda. */
function StubPanel({ title, description }: { title: string; description: string }) {
  return (
    <View className="gap-2 rounded-2xl border border-border bg-background/40 p-4">
      <View className="flex-row items-center gap-2">
        <Sparkles size={18} color="#94A3B8" strokeWidth={2.2} />
        <Text className="font-inter-semibold text-sm text-foreground">{title}</Text>
      </View>
      <Text className="font-sans text-sm leading-5 text-muted">{description}</Text>
      <Text className="font-sans text-xs text-muted">Per ora usa l’inserimento manuale per registrare i tuoi alimenti.</Text>
    </View>
  );
}

/**
 * Il picker restituisce `base64` solo se richiesto e, su alcune piattaforme
 * (web), può non farlo: in quel caso si ricostruisce dal file locale.
 */
async function toPickedPhoto(asset: ImagePicker.ImagePickerAsset): Promise<PickedPhoto> {
  const mimeType = asset.mimeType ?? "image/jpeg";
  if (asset.base64) return { uri: asset.uri, data: asset.base64, mimeType };
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return {
    uri: asset.uri,
    data: dataUrl.slice(dataUrl.indexOf(",") + 1),
    mimeType: blob.type || mimeType,
  };
}

function firstAsset(result: ImagePicker.ImagePickerResult): ImagePicker.ImagePickerAsset | null {
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0];
}

/**
 * Aggiunta alimento: l'inserimento manuale salva su POST /api/food-items
 * (con il pasto creato al primo uso) e la **foto + AI** è collegata a
 * POST /api/ai/meal-photo: Gemini stima alimenti e quantità, qui si
 * confermano prima di salvare. Barcode e upload della dieta restano stub
 * con messaggio esplicito.
 */
export function AddFoodModal({ visible, mealType, onClose, onAdd }: AddFoodModalProps) {
  const [mode, setMode] = useState<AddMode>("menu");
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<AiFoodItem[] | null>(null);
  const [excluded, setExcluded] = useState<Record<number, boolean>>({});
  const [photoError, setPhotoError] = useState<string | null>(null);
  const analyze = useAnalyzeMealPhoto();

  // Reset di tutto ciò che è trasitorio: la riapertura parte sempre dal
  // menu e senza residui della sessione precedente (un'effect che fa
  // setState all'apertura è vietata dal lint).
  function resetPhotoFlow() {
    setPhoto(null);
    setDescription("");
    setItems(null);
    setExcluded({});
    setPhotoError(null);
    analyze.reset();
  }

  function handleClose() {
    setMode("menu");
    resetPhotoFlow();
    onClose();
  }

  function handleBackToMenu() {
    resetPhotoFlow();
    setMode("menu");
  }

  function handleAdd(drafts: DietFoodDraft[], source: FoodSource) {
    onAdd(drafts, source);
    handleClose();
  }

  async function handlePickLibrary() {
    setPhotoError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
      });
      const asset = firstAsset(result);
      if (asset) setPhoto(await toPickedPhoto(asset));
    } catch {
      setPhotoError("Non sono riuscito a leggere l’immagine selezionata.");
    }
  }

  async function handleTakePhoto() {
    setPhotoError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setPhotoError("Per scattare la foto serve il permesso di usare la fotocamera.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
      });
      const asset = firstAsset(result);
      if (asset) setPhoto(await toPickedPhoto(asset));
    } catch {
      setPhotoError("Non sono riuscito a scattare la foto.");
    }
  }

  async function handleAnalyze() {
    if (!photo) return;
    setPhotoError(null);
    setItems(null);
    setExcluded({});
    try {
      const result = await analyze.mutateAsync({
        photo: photo.data,
        mimeType: photo.mimeType,
        description: description.trim(),
      });
      setItems(result.items);
    } catch (error) {
      setPhotoError(aiErrorMessage(error));
    }
  }

  function toggleItem(index: number) {
    setExcluded((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  function handleConfirmPhoto() {
    if (!items || items.length === 0) return;
    const drafts: DietFoodDraft[] = items
      .filter((_item, index) => !excluded[index])
      .map((item, index) => ({
        id: `photo-${Date.now()}-${index}`,
        name: item.name,
        quantityG: item.quantity_g,
        calories: item.calories,
        proteinG: item.protein_g,
        carbsG: item.carbs_g,
        fatsG: item.fat_g,
      }));
    if (drafts.length === 0) return;
    handleAdd(drafts, "photo");
  }

  const selectedCount = items ? items.filter((_item, index) => !excluded[index]).length : 0;
  const isAnalyzing = analyze.isPending;
  const title = mealType ? `${MODE_TITLES[mode]} — ${mealType}` : MODE_TITLES[mode];

  return (
    <Modal visible={visible} transparent animationType={Platform.OS === "web" ? "none" : "slide"} onRequestClose={handleClose} statusBarTranslucent>
      <View className="flex-1 justify-end bg-black/60">
        <View className="max-h-[92%] w-full rounded-t-3xl border-t border-border bg-surface" style={{ maxHeight: "92%" }}>
          <View className="flex-row items-center gap-2 border-b border-border px-3 py-2">
            {mode !== "menu" ? (
              <Pressable onPress={handleBackToMenu} className="h-11 w-11 items-center justify-center rounded-lg active:opacity-60">
                <X size={20} color="#94A3B8" strokeWidth={2.2} />
              </Pressable>
            ) : null}
            <Text className="flex-1 font-inter-bold text-base text-foreground" numberOfLines={1}>
              {title}
            </Text>
            <Pressable onPress={handleClose} className="h-11 w-11 items-center justify-center rounded-lg active:opacity-60">
              <X size={20} color="#94A3B8" strokeWidth={2.2} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 p-4 pb-8">
            {mode === "menu" ? (
              <View className="gap-3">
                <MenuOption icon={<Camera size={22} color="#F97316" strokeWidth={2.2} />} title="Scatta foto" description="Foto del piatto + descrizione, l'AI stima le quantità." onPress={() => setMode("photo")} />
                <MenuOption icon={<Barcode size={22} color="#22C55E" strokeWidth={2.2} />} title="Scansiona codice a barre" description="Inquadra il barcode e inserisci i grammi consumati." onPress={() => setMode("barcode")} />
                <MenuOption icon={<FileText size={22} color="#38BDF8" strokeWidth={2.2} />} title="Carica dieta esistente" description="PDF o foto della dieta da importare." onPress={() => setMode("upload")} />
                <MenuOption icon={<PenLine size={22} color="#A78BFA" strokeWidth={2.2} />} title="Inserimento manuale" description="Cerca tra 50+ alimenti italiani o inserisci a mano." onPress={() => setMode("manual")} />
              </View>
            ) : null}

            {mode === "photo" ? (
              <View className="gap-3">
                <Text className="font-sans text-xs leading-4 text-muted">
                  L’AI stima alimenti e quantità dalla foto: controlla il risultato prima di salvare. Nel piano free hai 2 analisi al giorno, con premium sono illimitate.
                </Text>

                {!photo ? (
                  <View className="gap-3 rounded-2xl border border-border bg-background/40 p-4">
                    <View className="flex-row gap-2">
                      {Platform.OS !== "web" ? (
                        <Pressable onPress={handleTakePhoto} className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3.5 active:opacity-80">
                          <Camera size={18} color="#0F172A" strokeWidth={2.2} />
                          <Text className="font-inter-bold text-sm text-primary-foreground">Scatta foto</Text>
                        </Pressable>
                      ) : null}
                      <Pressable onPress={handlePickLibrary} className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3.5 active:opacity-80">
                        <Images size={18} color="#0F172A" strokeWidth={2.2} />
                        <Text className="font-inter-bold text-sm text-primary-foreground">Scegli dalla galleria</Text>
                      </Pressable>
                    </View>
                    <Text className="text-center font-sans text-xs text-muted">JPEG o PNG, meglio se il piatto è interamente inquadrato.</Text>
                  </View>
                ) : (
                  <View className="gap-3 rounded-2xl border border-border bg-background/40 p-4">
                    <Image source={{ uri: photo.uri }} className="h-44 w-full rounded-xl" resizeMode="cover" />
                    <View>
                      <Text className="font-sans text-xs text-muted">Cosa hai mangiato? (facoltativo)</Text>
                      <TextInput
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Es. pasta al ragù e un panino"
                        placeholderTextColor="#64748B"
                        className="mt-1 rounded-lg border border-border bg-surface px-3 py-2.5 font-sans text-sm text-foreground"
                        multiline
                      />
                    </View>
                    <View className="flex-row gap-2">
                      <Pressable onPress={() => setPhoto(null)} className="flex-1 items-center rounded-xl border border-border bg-background/60 py-3 active:opacity-80">
                        <Text className="font-inter-semibold text-sm text-foreground">Cambia foto</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleAnalyze}
                        disabled={isAnalyzing}
                        className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3 ${isAnalyzing ? "bg-primary/40" : "bg-primary active:opacity-80"}`}
                      >
                        {isAnalyzing ? <ActivityIndicator size="small" color="#0F172A" /> : <Sparkles size={16} color="#0F172A" strokeWidth={2.2} />}
                        <Text className="font-inter-bold text-sm text-primary-foreground">{isAnalyzing ? "Analisi…" : "Analizza con AI"}</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {photoError ? (
                  <View className="gap-1 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
                    <Text className="font-inter-semibold text-sm text-destructive">Analisi non riuscita</Text>
                    <Text className="font-sans text-sm leading-5 text-muted">{photoError}</Text>
                  </View>
                ) : null}

                {items !== null ? (
                  items.length === 0 ? (
                    <View className="gap-1 rounded-xl border border-border bg-background/40 p-4">
                      <Text className="font-inter-semibold text-sm text-foreground">Nessun alimento riconosciuto</Text>
                      <Text className="font-sans text-sm leading-5 text-muted">Prova con una foto più nitida del piatto intero, oppure usa l’inserimento manuale.</Text>
                    </View>
                  ) : (
                    <View className="gap-2">
                      <Text className="font-inter-semibold text-sm text-foreground">Conferma gli alimenti rilevati</Text>
                      <Text className="font-sans text-xs leading-4 text-muted">Tocca un alimento per escluderlo: le quantità e i valori sono stime, puoi correggerli dopo dal diario.</Text>
                      {items.map((item, index) => {
                        const isSelected = !excluded[index];
                        return (
                          <Pressable
                            key={`${item.name}-${index}`}
                            onPress={() => toggleItem(index)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: isSelected }}
                            className={`flex-row items-center gap-3 rounded-xl border p-3 active:opacity-80 ${isSelected ? "border-primary/60 bg-primary/10" : "border-border bg-background/30 opacity-60"}`}
                          >
                            <View className={`h-5 w-5 items-center justify-center rounded border ${isSelected ? "border-primary bg-primary" : "border-border bg-background"}`}>
                              {isSelected ? <Check size={13} color="#0F172A" strokeWidth={3} /> : null}
                            </View>
                            <View className="flex-1">
                              <Text className="font-inter-semibold text-sm text-foreground" numberOfLines={1}>{item.name}</Text>
                              <Text className="font-sans text-xs text-muted">
                                {Math.round(item.quantity_g)} g · {item.calories} kcal · P {Math.round(item.protein_g)} · C {Math.round(item.carbs_g)} · G {Math.round(item.fat_g)}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                      <Pressable
                        onPress={handleConfirmPhoto}
                        disabled={selectedCount === 0}
                        className={`items-center rounded-xl py-3.5 ${selectedCount === 0 ? "bg-primary/40 opacity-60" : "bg-primary active:opacity-80"}`}
                      >
                        <Text className="font-inter-bold text-base text-primary-foreground">
                          {selectedCount === 0 ? "Seleziona almeno un alimento" : `Aggiungi ${selectedCount} ${selectedCount === 1 ? "alimento" : "alimenti"}`}
                        </Text>
                      </Pressable>
                    </View>
                  )
                ) : null}
              </View>
            ) : null}

            {mode === "barcode" ? (
              <StubPanel
                title="Barcode non ancora collegato"
                description="Il lookup su Open Food Facts non è collegato al backend: cerca l'alimento tra quelli italiani o inseriscilo a mano."
              />
            ) : null}

            {mode === "upload" ? (
              <StubPanel
                title="Upload dieta non ancora disponibile"
                description="La lettura automatica con AI (foto o PDF) non è ancora collegata in app: compila i pasti a mano per ora."
              />
            ) : null}

            {mode === "manual" ? <ManualFoodForm onAdd={(draft) => handleAdd([draft], "manual")} /> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
