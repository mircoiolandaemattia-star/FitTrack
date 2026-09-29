import { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Barcode, Camera, FileText, PenLine, Sparkles, X } from "lucide-react-native";
import type { DietFoodDraft } from "@/types";
import type { MealType } from "@/lib/dietaStore";
import { ManualFoodForm } from "./ManualFoodForm";

type AddMode = "menu" | "photo" | "barcode" | "manual" | "upload";

type AddFoodModalProps = {
  visible: boolean;
  mealType: MealType | null;
  onClose: () => void;
  onAdd: (draft: DietFoodDraft) => void;
};

const MODE_TITLES: Record<AddMode, string> = {
  menu: "Aggiungi alimento",
  photo: "Scatta foto",
  barcode: "Scansiona codice a barre",
  manual: "Inserimento manuale",
  upload: "Carica dieta esistente",
};

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
 * Aggiunta alimento: l'inserimento manuale salva su POST /api/food-items
 * (con il pasto creato al primo uso). Foto+AI, barcode Open Food Facts e
 * upload della dieta restano stub con messaggio esplicito.
 */
export function AddFoodModal({ visible, mealType, onClose, onAdd }: AddFoodModalProps) {
  const [mode, setMode] = useState<AddMode>("menu");

  // Reset della modalità alla chiusura: la riapertura parte sempre dal menu
  // (un'effect che fa setState all'apertura è vietata dal lint).
  function handleClose() {
    setMode("menu");
    onClose();
  }

  function handleAdd(draft: DietFoodDraft) {
    onAdd(draft);
    handleClose();
  }

  const title = mealType ? `${MODE_TITLES[mode]} — ${mealType}` : MODE_TITLES[mode];

  return (
    <Modal visible={visible} transparent animationType={Platform.OS === "web" ? "none" : "slide"} onRequestClose={handleClose} statusBarTranslucent>
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
              <StubPanel
                title="Foto + AI non ancora collegata"
                description="L'analisi del piatto con testo e stima delle quantità arriverà con l'integrazione del modello Gemini."
              />
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
                description="Importare un PDF o una foto di dieta richiede lo storage dei file, non ancora configurato."
              />
            ) : null}

            {mode === "manual" ? <ManualFoodForm onAdd={handleAdd} /> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
