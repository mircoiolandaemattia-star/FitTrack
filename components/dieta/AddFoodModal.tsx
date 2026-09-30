import { useState } from "react";
import { ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Barcode, Camera, Check, FileText, Images, PenLine, ScanLine, Sparkles, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import type { DietFoodDraft } from "@/types";
import type { MealType } from "@/lib/dietaStore";
import { aiErrorMessage, useAnalyzeMealPhoto, useReadFile, type AiFoodItem } from "@/lib/aiQueries";
import { documentMimeType, DocumentReadError, readDocumentBase64 } from "@/lib/fileReader";
import { foodLookupErrorMessage, useLookupBarcode, type BarcodeProduct } from "@/lib/foodLookup";
import { BarcodeScannerModal } from "./BarcodeScannerModal";
import { ManualFoodForm } from "./ManualFoodForm";

type AddMode = "menu" | "photo" | "barcode" | "manual" | "upload";

/** Provenienza degli alimenti: diventa `food_items.source`. */
export type FoodSource = "manual" | "photo" | "upload" | "barcode";

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

/** Pannello di testo informativo (formato comune alle modalità collegate). */
function InfoPanel({ title, description }: { title: string; description: string }) {
  return (
    <View className="gap-1 rounded-2xl border border-border bg-background/40 p-4">
      <View className="flex-row items-center gap-2">
        <Sparkles size={18} color="#94A3B8" strokeWidth={2.2} />
        <Text className="font-inter-semibold text-sm text-foreground">{title}</Text>
      </View>
      <Text className="font-sans text-sm leading-5 text-muted">{description}</Text>
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
 * Aggiunta alimento: tutte le modalità sono collegate al backend.
 *
 * - manuale → `POST /api/food-items` (il pasto nasce al primo uso);
 * - foto + AI → `POST /api/ai/meal-photo`, con i risultati da confermare;
 * - codice a barre → `GET /api/food-items/lookup` (proxy Open Food Facts);
 * - upload dieta → `POST /api/ai/file-read` (bozza da confermare).
 *
 * Nessuna scrittura avviene prima della conferma: gli alimenti arrivano
 * tutti insieme su `onAdd`, che li salva con la provenienza giusta.
 */
export function AddFoodModal({ visible, mealType, onClose, onAdd }: AddFoodModalProps) {
  const [mode, setMode] = useState<AddMode>("menu");
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [description, setDescription] = useState("");
  /** Alimenti estratti (foto o file) in attesa di conferma. */
  const [items, setItems] = useState<AiFoodItem[] | null>(null);
  /** Da dove viene la lista: decide il `food_items.source` alla conferma. */
  const [itemSource, setItemSource] = useState<"photo" | "upload">("photo");
  const [excluded, setExcluded] = useState<Record<number, boolean>>({});
  /** Errore del flusso in corso (foto, file o barcode, a seconda della mode). */
  const [flowError, setFlowError] = useState<string | null>(null);
  /** File scelto per l'importazione, mostrato durante l'analisi. */
  const [documentName, setDocumentName] = useState<string | null>(null);

  // Barcode: prodotto trovato e quantità che l'utente dichiara di mangiare.
  const [barcode, setBarcode] = useState("");
  const [barcodeProduct, setBarcodeProduct] = useState<BarcodeProduct | null>(null);
  const [barcodeQty, setBarcodeQty] = useState("100");
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  /** Scanner con la fotocamera (solo nativo, aperto dal pulsante). */
  const [scannerOpen, setScannerOpen] = useState(false);

  const analyze = useAnalyzeMealPhoto();
  const readFile = useReadFile();
  const lookup = useLookupBarcode();

  // Reset di tutto ciò che è trasitorio: la riapertura parte sempre dal
  // menu e senza residui della sessione precedente (un'effect che fa
  // setState all'apertura è vietata dal lint).
  function resetTransient() {
    setPhoto(null);
    setDescription("");
    setItems(null);
    setItemSource("photo");
    setExcluded({});
    setFlowError(null);
    setDocumentName(null);
    setBarcode("");
    setBarcodeProduct(null);
    setBarcodeQty("100");
    setBarcodeError(null);
    setScannerOpen(false);
    analyze.reset();
    readFile.reset();
    lookup.reset();
  }

  function handleClose() {
    setMode("menu");
    resetTransient();
    onClose();
  }

  function handleBackToMenu() {
    resetTransient();
    setMode("menu");
  }

  function handleAdd(drafts: DietFoodDraft[], source: FoodSource) {
    onAdd(drafts, source);
    handleClose();
  }

  async function handlePickLibrary() {
    setFlowError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
      });
      const asset = firstAsset(result);
      if (asset) setPhoto(await toPickedPhoto(asset));
    } catch {
      setFlowError("Non sono riuscito a leggere l’immagine selezionata.");
    }
  }

  async function handleTakePhoto() {
    setFlowError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setFlowError("Per scattare la foto serve il permesso di usare la fotocamera.");
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
      setFlowError("Non sono riuscito a scattare la foto.");
    }
  }

  async function handleAnalyze() {
    if (!photo) return;
    setFlowError(null);
    setItems(null);
    setItemSource("photo");
    setExcluded({});
    try {
      const result = await analyze.mutateAsync({
        photo: photo.data,
        mimeType: photo.mimeType,
        description: description.trim(),
      });
      setItems(result.items);
    } catch (error) {
      setFlowError(aiErrorMessage(error));
    }
  }

  /**
   * Importa una dieta esistente: file → `POST /api/ai/file-read` → gli
   * alimenti di tutti i pasti diventano una lista da spuntare e aggiungere
   * al pasto aperto. Nessun salvataggio finché non si conferma.
   */
  async function handlePickDocument() {
    setFlowError(null);
    setItems(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      setDocumentName(asset.name);
      const mimeType = documentMimeType(asset);
      const file = await readDocumentBase64(asset);
      const extracted = await readFile.mutateAsync({ file, mimeType, kind: "diet" });
      if (extracted.kind !== "diet") {
        setFlowError("Il file sembra una scheda di allenamento: importala dalla sezione Scheda.");
        return;
      }
      const foods = extracted.diet.meals.flatMap((meal) => meal.foods);
      if (foods.length === 0) {
        setFlowError("Nessun alimento leggibile nel file: prova con un’immagine più nitida oppure inserisci a mano.");
        return;
      }
      setItems(foods);
      setItemSource("upload");
      setExcluded({});
    } catch (error) {
      setFlowError(error instanceof DocumentReadError ? error.message : aiErrorMessage(error));
    }
  }

  /**
   * Cerca il prodotto su Open Food Facts (chiamata passando dal backend).
   * La usano sia il campo manuale sia lo scanner della fotocamera.
   */
  function startBarcodeLookup(value: string) {
    const code = value.trim();
    setBarcode(code);
    setBarcodeError(null);
    setBarcodeProduct(null);
    if (code.length < 8 || code.length > 14 || !/^\d+$/.test(code)) {
      setBarcodeError("Il codice deve contenere da 8 a 14 cifre.");
      return;
    }
    lookup.mutate(code, {
      // La risposta della mutation va copiata nello stato locale: senza
      // questo collegamento la ricerca terminava senza errori ma senza mai
      // mostrare il prodotto (nessuno leggeva `lookup.data`).
      onSuccess: (product) => setBarcodeProduct(product),
      onError: (error) => setBarcodeError(foodLookupErrorMessage(error)),
    });
  }

  function handleLookupBarcode() {
    startBarcodeLookup(barcode);
  }

  /**
   * Apre lo scanner senza attendere nulla: il permesso di fotocamera lo
   * richiede il modal (con la schermata di ripiego se negato), così un
   * rifiuto o un errore non chiudono silenziosamente il flusso.
   */
  function handleOpenScanner() {
    setBarcodeError(null);
    Keyboard.dismiss();
    setScannerOpen(true);
  }

  /** Codice letto: si chiude lo scanner e si cerca subito il prodotto. */
  function handleScannerScan(code: string) {
    setScannerOpen(false);
    startBarcodeLookup(code);
  }

  function toggleItem(index: number) {
    setExcluded((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  /** Conferma della lista estratta (foto o file): gli alimenti scelti vanno al pasto. */
  function handleConfirmItems() {
    if (!items || items.length === 0) return;
    const drafts: DietFoodDraft[] = items
      .filter((_item, index) => !excluded[index])
      .map((item, index) => ({
        id: `${itemSource}-${Date.now()}-${index}`,
        name: item.name,
        quantityG: item.quantity_g,
        calories: item.calories,
        proteinG: item.protein_g,
        carbsG: item.carbs_g,
        fatsG: item.fat_g,
      }));
    if (drafts.length === 0) return;
    handleAdd(drafts, itemSource);
  }

  /** Aggiunge il prodotto del barcode con la quantità dichiarata (in grammi). */
  function handleAddBarcode() {
    if (!barcodeProduct) return;
    const quantityG = parseFloat(barcodeQty.replace(",", ".")) || 0;
    if (quantityG <= 0) return;
    const factor = quantityG / 100;
    handleAdd(
      [
        {
          id: `barcode-${Date.now()}`,
          name: barcodeProduct.name,
          quantityG,
          calories: Math.round(barcodeProduct.calories * factor),
          proteinG: Math.round(barcodeProduct.protein_g * factor * 10) / 10,
          carbsG: Math.round(barcodeProduct.carbs_g * factor * 10) / 10,
          fatsG: Math.round(barcodeProduct.fat_g * factor * 10) / 10,
        },
      ],
      "barcode",
    );
  }

  const selectedCount = items ? items.filter((_item, index) => !excluded[index]).length : 0;
  const isAnalyzing = analyze.isPending;
  const isReadingFile = readFile.isPending;
  const isLookingUp = lookup.isPending;
  const barcodeQuantity = parseFloat(barcodeQty.replace(",", ".")) || 0;
  const barcodeFactor = barcodeQuantity / 100;
  const title = mealType ? `${MODE_TITLES[mode]} — ${mealType}` : MODE_TITLES[mode];

  /**
   * Lista condivisa fra foto e file: gli alimenti estratti si confermano
   * alla stessa maniera, cambiando solo il `food_items.source` finale.
   */
  const itemsConfirm =
    items === null ? null : items.length === 0 ? (
      <View className="gap-1 rounded-xl border border-border bg-background/40 p-4">
        <Text className="font-inter-semibold text-sm text-foreground">Nessun alimento riconosciuto</Text>
        <Text className="font-sans text-sm leading-5 text-muted">Prova con una foto più nitida del piatto intero, oppure usa l’inserimento manuale.</Text>
      </View>
    ) : (
      <View className="gap-2">
        <Text className="font-inter-semibold text-sm text-foreground">Conferma gli alimenti rilevati</Text>
        <Text className="font-sans text-xs leading-4 text-muted">
          Tocca un alimento per escluderlo: le quantità e i valori sono stime, puoi correggerli dopo dal diario.
        </Text>
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
          onPress={handleConfirmItems}
          disabled={selectedCount === 0}
          className={`items-center rounded-xl py-3.5 ${selectedCount === 0 ? "bg-primary/40 opacity-60" : "bg-primary active:opacity-80"}`}
        >
          <Text className="font-inter-bold text-base text-primary-foreground">
            {selectedCount === 0 ? "Seleziona almeno un alimento" : `Aggiungi ${selectedCount} ${selectedCount === 1 ? "alimento" : "alimenti"}`}
          </Text>
        </Pressable>
      </View>
    );

  return (
    <>
      <Modal visible={visible} transparent animationType={Platform.OS === "web" ? "none" : "slide"} onRequestClose={handleClose} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 justify-end bg-black/60">
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
                  <MenuOption icon={<Barcode size={22} color="#22C55E" strokeWidth={2.2} />} title="Codice a barre" description="Cerca il prodotto per codice e indica i grammi che mangi." onPress={() => setMode("barcode")} />
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

                  {flowError ? (
                    <View className="gap-1 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
                      <Text className="font-inter-semibold text-sm text-destructive">Analisi non riuscita</Text>
                      <Text className="font-sans text-sm leading-5 text-muted">{flowError}</Text>
                    </View>
                  ) : null}

                  {itemsConfirm}
                </View>
              ) : null}

              {mode === "barcode" ? (
                <View className="gap-3">
                  <InfoPanel
                    title="Cerca per codice a barre"
                    description="Il prodotto arriva da Open Food Facts: controlla i valori nutrizionali e indica quanti grammi mangi."
                  />

                  {Platform.OS !== "web" ? (
                    <Pressable
                      onPress={() => void handleOpenScanner()}
                      accessibilityRole="button"
                      accessibilityLabel="Scansiona il codice a barre con la fotocamera"
                      className="flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3.5 active:opacity-80"
                    >
                      <ScanLine size={18} color="#0F172A" strokeWidth={2.4} />
                      <Text className="font-inter-bold text-sm text-primary-foreground">Scansiona con la fotocamera</Text>
                    </Pressable>
                  ) : null}

                  <Text className="font-sans text-xs text-muted">
                    {Platform.OS !== "web" ? "Oppure inserisci il codice a mano:" : "Inserisci il codice a barre del prodotto:"}
                  </Text>

                  <View className="flex-row gap-2">
                    <TextInput
                      value={barcode}
                      onChangeText={setBarcode}
                      placeholder="Es. 8000500310427"
                      placeholderTextColor="#64748B"
                      keyboardType="numeric"
                      accessibilityLabel="Codice a barre"
                      className="flex-1 rounded-lg border border-border bg-surface px-3 py-3 font-sans text-sm text-foreground"
                      onSubmitEditing={handleLookupBarcode}
                    />
                    <Pressable
                      onPress={handleLookupBarcode}
                      disabled={isLookingUp}
                      accessibilityRole="button"
                      accessibilityLabel="Cerca il prodotto"
                      className={`flex-row items-center justify-center gap-2 rounded-lg px-4 ${isLookingUp ? "bg-primary/40" : "bg-primary active:opacity-80"}`}
                    >
                      {isLookingUp ? (
                        <ActivityIndicator size="small" color="#0F172A" />
                      ) : (
                        <ScanLine size={16} color="#0F172A" strokeWidth={2.4} />
                      )}
                      <Text className="font-inter-bold text-sm text-primary-foreground">{isLookingUp ? "Ricerca…" : "Cerca"}</Text>
                    </Pressable>
                  </View>

                  {barcodeError ? (
                    <View className="gap-1 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
                      <Text className="font-inter-semibold text-sm text-destructive">Ricerca non riuscita</Text>
                      <Text className="font-sans text-sm leading-5 text-muted">{barcodeError}</Text>
                    </View>
                  ) : null}

                  {barcodeProduct ? (
                    <View className="gap-3 rounded-2xl border border-border bg-background/40 p-4">
                      <View>
                        <Text className="font-inter-semibold text-base text-foreground" numberOfLines={2}>
                          {barcodeProduct.name}
                        </Text>
                        <Text className="mt-0.5 font-sans text-xs text-muted">
                          {[barcodeProduct.brand, barcodeProduct.barcode].filter(Boolean).join(" · ")}
                        </Text>
                      </View>

                      <View>
                        <Text className="font-sans text-xs text-muted">Quantità mangiata (g)</Text>
                        <TextInput
                          value={barcodeQty}
                          onChangeText={setBarcodeQty}
                          keyboardType="numeric"
                          accessibilityLabel="Quantità in grammi"
                          placeholder="100"
                          placeholderTextColor="#64748B"
                          className="mt-1 rounded-lg border border-border bg-surface px-3 py-2.5 font-sans text-sm text-foreground"
                        />
                      </View>

                      {barcodeProduct.serving_g ? (
                        <Pressable
                          onPress={() => setBarcodeQty(String(barcodeProduct.serving_g))}
                          accessibilityRole="button"
                          className="self-start rounded-full border border-border bg-surface px-3 py-1.5 active:opacity-80"
                        >
                          <Text className="font-inter-semibold text-xs text-muted">
                            Usa la porzione dichiarata ({barcodeProduct.serving_g} g)
                          </Text>
                        </Pressable>
                      ) : null}

                      <View className="rounded-xl border border-border bg-surface p-3">
                        <Text className="font-inter-semibold text-sm text-foreground">
                          {Math.round(barcodeProduct.calories * barcodeFactor)} kcal per {barcodeQuantity > 0 ? Math.round(barcodeQuantity) : 0} g
                        </Text>
                        <Text className="mt-0.5 font-sans text-xs text-muted">
                          P {Math.round(barcodeProduct.protein_g * barcodeFactor * 10) / 10} · C{" "}
                          {Math.round(barcodeProduct.carbs_g * barcodeFactor * 10) / 10} · G{" "}
                          {Math.round(barcodeProduct.fat_g * barcodeFactor * 10) / 10} (valori per 100 g: {barcodeProduct.calories} kcal)
                        </Text>
                      </View>

                      {barcodeProduct.notes ? (
                        <Text className="font-sans text-xs leading-4 text-muted">{barcodeProduct.notes}</Text>
                      ) : null}

                      <Pressable
                        onPress={handleAddBarcode}
                        disabled={barcodeQuantity <= 0}
                        accessibilityRole="button"
                        className={`items-center rounded-xl py-3.5 ${barcodeQuantity <= 0 ? "bg-primary/40 opacity-60" : "bg-primary active:opacity-80"}`}
                      >
                        <Text className="font-inter-bold text-base text-primary-foreground">
                          {barcodeQuantity <= 0 ? "Indica quanti grammi mangi" : "Aggiungi al pasto"}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {mode === "upload" ? (
                <View className="gap-3">
                  <InfoPanel
                    title="Importa una dieta esistente"
                    description="Scegli il PDF o la foto della dieta: l’AI ne estrae gli alimenti e li elenca qui sopra per conferma, senza salvare nulla. Funzione premium."
                  />

                  <Pressable
                    onPress={handlePickDocument}
                    disabled={isReadingFile}
                    accessibilityRole="button"
                    accessibilityLabel="Scegli un file PDF o una foto della dieta"
                    className={`flex-row items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background/40 py-8 ${isReadingFile ? "opacity-60" : "active:opacity-80"}`}
                  >
                    {isReadingFile ? (
                      <ActivityIndicator size="small" color="#F97316" />
                    ) : (
                      <FileText size={24} color="#F97316" strokeWidth={2.2} />
                    )}
                    <Text className="font-inter-semibold text-sm text-foreground">
                      {isReadingFile ? "Lettura con AI…" : items ? "Scegli un altro file" : "Scegli file (PDF o foto)"}
                    </Text>
                  </Pressable>

                  {isReadingFile && documentName ? (
                    <Text className="text-center font-sans text-xs text-muted">{documentName}</Text>
                  ) : null}

                  {flowError ? (
                    <View className="gap-1 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
                      <Text className="font-inter-semibold text-sm text-destructive">Importazione non riuscita</Text>
                      <Text className="font-sans text-sm leading-5 text-muted">{flowError}</Text>
                    </View>
                  ) : null}

                  {itemsConfirm}
                </View>
              ) : null}

              {mode === "manual" ? <ManualFoodForm onAdd={(draft) => handleAdd([draft], "manual")} /> : null}
            </ScrollView>
          </View>

          {/* Scanner a schermo intero: va annidato DENTRO questo Modal.
              Come fratello finirebbe sotto la root view controller, che sta
              già presentando questo modal: iOS rifiuta la seconda
              presentazione in silenzio e il tap non mostrava nulla. */}
          {scannerOpen ? (
            <BarcodeScannerModal visible onClose={() => setScannerOpen(false)} onScanned={handleScannerScan} />
          ) : null}
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
