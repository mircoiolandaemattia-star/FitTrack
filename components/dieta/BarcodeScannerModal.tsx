import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeType } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, X } from "lucide-react-native";

type BarcodeScannerModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Codice letto: il chiamante avvia la ricerca del prodotto. */
  onScanned: (code: string) => void;
};

/**
 * Formati letti sia da iOS (ZXing) sia da Android: le confezioni alimentari
 * sono EAN-13/EAN-8 in Europa e UPC negli USA, più i code39/code93/code128
 * degli artigianali e l'ITF delle scatole da imballo.
 */
const BARCODE_TYPES: BarcodeType[] = [
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
  "code39",
  "code93",
  "code128",
  "itf14",
];

/**
 * Scanner a schermo intero per il codice a barre (solo nativo: la PWA non
 * ha un decoder di codici utilizzabile, resta l'inserimento manuale).
 *
 * Il permesso viene chiesto dal chiamante alla pressione del pulsante; qui
 * resta solo il ripiego (permesso revocato o negato).
 */
export function BarcodeScannerModal({ visible, onClose, onScanned }: BarcodeScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const lastScan = useRef<{ code: string; at: number } | null>(null);
  const askedOnce = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);

  /**
   * Il permesso viene chiesto qui aprendo il modal: se è già concesso la
   * promise risolve subito, altrimenti parte il dialogo di sistema sopra lo
   * scanner. Prima la chiedeva il chiamante prima di aprire, e un rifiuto o
   * un errore restavano senza feedback visibile.
   */
  useEffect(() => {
    if (!permission || askedOnce.current) return;
    if (permission.granted || !permission.canAskAgain || permission.status !== "undetermined") return;
    askedOnce.current = true;
    void requestPermission().catch(() => {});
  }, [permission, requestPermission]);

  function handleScanned(code: string) {
    const clean = code.trim();
    if (!clean) return;
    const now = Date.now();
    const previous = lastScan.current;
    // Il rilevatore scansiona più volte al secondo: lo stesso codice viene
    // accettato una sola volta mentre il chiamante chiude il modal.
    if (previous && previous.code === clean && now - previous.at < 2500) return;
    lastScan.current = { code: clean, at: now };
    onScanned(clean);
  }

  const granted = permission?.granted ?? false;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        {granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
            onBarcodeScanned={(result) => handleScanned(result.data)}
            onCameraReady={() => setCameraReady(true)}
            onMountError={(event) => setMountError(event.message)}
          />
        ) : (
          <View className="flex-1 items-center justify-center gap-4 px-8">
            <Camera size={40} color="#94A3B8" strokeWidth={2} />
            {permission === null ? (
              <ActivityIndicator color="#F97316" />
            ) : (
              <>
                <Text className="text-center font-inter-semibold text-base text-foreground">Serve il permesso per la fotocamera</Text>
                <Text className="text-center font-sans text-sm leading-5 text-muted">
                  La fotocamera viene usata solo per leggere il codice a barre del prodotto.
                </Text>
                {permission.canAskAgain ? (
                  <Pressable
                    onPress={() => void requestPermission()}
                    accessibilityRole="button"
                    accessibilityLabel="Consenti l’uso della fotocamera"
                    className="rounded-xl bg-primary px-6 py-3 active:opacity-80"
                  >
                    <Text className="font-inter-bold text-sm text-primary-foreground">Consenti fotocamera</Text>
                  </Pressable>
                ) : (
                  <Text className="text-center font-sans text-xs leading-4 text-muted">
                    Permesso negato: abilitalo dalle impostazioni di sistema del dispositivo.
                  </Text>
                )}
              </>
            )}
          </View>
        )}

        {granted ? (
          <>
            {/* Il permesso non basta: se la camera non parte (o è occupata da
                un'altra app) qui compare il motivo invece di uno schermo nero. */}
            {mountError ? (
              <View style={{ top: insets.top + 64 }} className="absolute left-4 right-4 gap-1 rounded-xl border border-destructive/50 bg-black/85 p-3">
                <Text className="font-inter-semibold text-sm text-destructive">Fotocamera non disponibile</Text>
                <Text className="font-sans text-xs leading-4 text-white/80">{mountError}</Text>
              </View>
            ) : null}

            {!cameraReady && !mountError ? (
              <View pointerEvents="none" style={StyleSheet.absoluteFill} className="items-center justify-center gap-3">
                <ActivityIndicator color="#F97316" size="large" />
                <Text className="font-inter-semibold text-base text-white">Avvio fotocamera…</Text>
              </View>
            ) : null}

            {/* Finestra di inquadratura: zona scura attorno al riquadro. */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View className="h-44 bg-black/60" />
              <View className="flex-row flex-1">
                <View className="w-10 bg-black/60" />
                <View className="flex-1 items-center justify-center">
                  <View className="h-44 w-full rounded-2xl border-2 border-primary/80" />
                </View>
                <View className="w-10 bg-black/60" />
              </View>
              <View className="flex-1 bg-black/60" />
            </View>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Chiudi lo scanner"
              style={{ top: insets.top + 8 }}
              className="absolute right-4 h-11 w-11 items-center justify-center rounded-full bg-black/70 active:opacity-70"
            >
              <X size={22} color="#FFFFFF" strokeWidth={2.4} />
            </Pressable>

            <View pointerEvents="none" className="absolute bottom-16 left-0 right-0 items-center px-8">
              <Text className="text-center font-inter-semibold text-base text-white">Inquadra il codice a barre</Text>
              <Text className="mt-1 text-center font-sans text-sm text-white/70">
                Il prodotto arriva da Open Food Facts: controlla i valori prima di salvare.
              </Text>
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}
