import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Barcode, Camera, FileText, PenLine, X } from "lucide-react-native";
import type { DietFoodDraft } from "@/types";
import type { MealType } from "@/lib/dietaStore";
import { BarcodeScannerFlow } from "./BarcodeScannerFlow";
import { ManualFoodForm } from "./ManualFoodForm";
import { PhotoRecognitionFlow } from "./PhotoRecognitionFlow";
import { PremiumUpsellModal } from "./PremiumUpsellModal";

type AddMode = "menu" | "photo" | "barcode" | "manual" | "upload" | "upload-loading" | "upload-success";

type AddFoodModalProps = {
  visible: boolean;
  mealType: MealType | null;
  onClose: () => void;
  onAdd: (draft: DietFoodDraft) => void;
  isPremium: boolean;
};

const MODE_TITLES: Record<AddMode, string> = {
  menu: "Aggiungi alimento",
  photo: "Scatta foto",
  barcode: "Scansiona codice a barre",
  manual: "Inserimento manuale",
  upload: "Carica dieta esistente",
  "upload-loading": "Carica dieta esistente",
  "upload-success": "Carica dieta esistente",
};

function MenuOption({ icon, title, description, onPress, badge }: { icon: React.ReactNode; title: string; description: string; onPress: () => void; badge?: string }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 rounded-2xl border border-border bg-background/40 p-4 active:opacity-80">
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-surface">{icon}</View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="font-inter-semibold text-base text-foreground">{title}</Text>
          {badge ? (
            <View className="rounded-full bg-amber-500/15 px-2 py-0.5">
              <Text className="font-inter-bold text-xs text-amber-400">{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text className="mt-0.5 font-sans text-sm leading-5 text-muted">{description}</Text>
      </View>
    </Pressable>
  );
}

export function AddFoodModal({ visible, mealType, onClose, onAdd, isPremium }: AddFoodModalProps) {
  const [mode, setMode] = useState<AddMode>("menu");
  const [showUpsell, setShowUpsell] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setMode("menu");
    setShowUpsell(false);
    setUploadFileName(null);
  }, [visible]);

  function handleAdd(draft: DietFoodDraft) {
    onAdd(draft);
    onClose();
  }

  async function handlePickUpload() {
    if (!isPremium) {
      setShowUpsell(true);
      return;
    }
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
      if (res.canceled) return;
      const name = res.assets?.[0]?.name ?? "Dieta.pdf";
      setUploadFileName(name);
      setMode("upload-loading");
      setTimeout(() => setMode("upload-success"), 2000);
    } catch {}
  }

  function handleUploadMode() {
    if (!isPremium) {
      setShowUpsell(true);
      return;
    }
    setMode("upload");
  }

  const title = mealType ? `${MODE_TITLES[mode]} — ${mealType}` : MODE_TITLES[mode];

  return (
    <>
      <Modal visible={visible} transparent animationType={Platform.OS === "web" ? "none" : "slide"} onRequestClose={onClose} statusBarTranslucent>
        <View className="flex-1 justify-end bg-black/60">
          <View className="max-h-[92%] w-full rounded-t-3xl border-t border-border bg-surface" style={{ maxHeight: "92%" }}>
            <View className="flex-row items-center gap-2 border-b border-border px-3 py-2">
              {mode !== "menu" ? (
                <Pressable onPress={() => setMode("menu")} className="h-11 w-11 items-center justify-center rounded-lg active:opacity-60">
                  <X size={20} color="#94A3B8" strokeWidth={2.2} />
                </Pressable>
              ) : null}
              <Text className="flex-1 font-inter-bold text-base text-foreground" numberOfLines={1}>
                {title}
              </Text>
              <Pressable onPress={onClose} className="h-11 w-11 items-center justify-center rounded-lg active:opacity-60">
                <X size={20} color="#94A3B8" strokeWidth={2.2} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 p-4 pb-8">
              {mode === "menu" ? (
                <View className="gap-3">
                  <MenuOption icon={<Camera size={22} color="#F97316" strokeWidth={2.2} />} title="Scatta foto" description="Foto del piatto + descrizione, l'AI stima le quantità." onPress={() => setMode("photo")} badge={!isPremium ? "2/giorno" : undefined} />
                  <MenuOption icon={<Barcode size={22} color="#22C55E" strokeWidth={2.2} />} title="Scansiona codice a barre" description="Inquadra il barcode e inserisci i grammi consumati." onPress={() => setMode("barcode")} />
                  <MenuOption icon={<FileText size={22} color="#38BDF8" strokeWidth={2.2} />} title="Carica dieta esistente" description="PDF o foto della dieta da importare." onPress={handleUploadMode} badge="Premium" />
                  <MenuOption icon={<PenLine size={22} color="#A78BFA" strokeWidth={2.2} />} title="Inserimento manuale" description="Cerca tra 50+ alimenti italiani o inserisci a mano." onPress={() => setMode("manual")} />
                </View>
              ) : null}

              {mode === "photo" ? <PhotoRecognitionFlow onAdd={handleAdd} isPremium={isPremium} /> : null}
              {mode === "barcode" ? <BarcodeScannerFlow onAdd={handleAdd} /> : null}
              {mode === "manual" ? <ManualFoodForm onAdd={handleAdd} /> : null}

              {mode === "upload" ? (
                <View className="gap-4">
                  <Text className="font-sans text-sm leading-5 text-muted">Seleziona un PDF o una foto della tua dieta: verrà elaborata (mock).</Text>
                  <Pressable onPress={handlePickUpload} className="items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background/40 py-8 active:opacity-80">
                    <FileText size={24} color="#38BDF8" strokeWidth={2.2} />
                    <Text className="font-inter-semibold text-sm text-foreground">Scegli file (PDF o foto)</Text>
                  </Pressable>
                </View>
              ) : null}

              {mode === "upload-loading" ? (
                <View className="items-center gap-3 py-10">
                  <ActivityIndicator size="large" color="#F97316" />
                  <Text className="font-inter-semibold text-base text-foreground">Elaborazione in corso...</Text>
                  {uploadFileName ? <Text className="font-sans text-sm text-muted">{uploadFileName}</Text> : null}
                </View>
              ) : null}

              {mode === "upload-success" ? (
                <View className="items-center gap-3 py-6">
                  <View className="h-14 w-14 items-center justify-center rounded-full bg-accent/15">
                    <Text className="font-inter-bold text-xl text-accent">✓</Text>
                  </View>
                  <Text className="font-inter-bold text-lg text-foreground">Dieta importata con successo</Text>
                  {uploadFileName ? <Text className="font-sans text-sm text-muted">{uploadFileName}</Text> : null}
                  <Text className="text-center font-sans text-xs text-muted">Mock: i pasti della dieta importata verranno uniti a quelli odierni.</Text>
                  <Pressable onPress={onClose} className="mt-2 w-full items-center rounded-xl bg-primary py-3.5 active:opacity-80">
                    <Text className="font-inter-bold text-base text-primary-foreground">Chiudi</Text>
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <PremiumUpsellModal visible={showUpsell} onClose={() => setShowUpsell(false)} title="Funzione Premium" description="Caricare una dieta esistente è disponibile solo per utenti Premium o in prova." />
    </>
  );
}
