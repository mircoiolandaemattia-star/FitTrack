import { useEffect, useState } from "react";
import { Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { Download, Share, Smartphone, X } from "lucide-react-native";
import { Card } from "@/components/home/Card";
import { useIsStandalone } from "@/lib/useStandalone";

const DISMISS_KEY = "fittrack_pwa_banner_dismissed";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || ((navigator as unknown as { platform: string }).platform === "MacIntel" && (navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1);
}

export function PWAInstallBanner() {
  const { width } = useWindowDimensions();
  const isStandalone = useIsStandalone();
  const [dismissed, setDismissed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<unknown>(null);
  const [canInstall, setCanInstall] = useState(false);

  const isWebMobile = Platform.OS === "web" && width < 768 && !isStandalone;

  useEffect(() => {
    // Solo su web: su React Native window === global e NON esistono
    // window.addEventListener né localStorage → "undefined is not a
    // function" e crash silenzioso all'avvio (niente red screen in Release).
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    if (typeof window.addEventListener !== "function") return;

    const stored = window.localStorage?.getItem(DISMISS_KEY);
    if (stored === "1") setDismissed(true);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  function handleDismiss() {
    setDismissed(true);
    try {
      window.localStorage?.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  async function handleInstall() {
    const prompt = deferredPrompt as { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: string }> } | null;
    if (prompt?.prompt) {
      await prompt.prompt();
      try {
        await prompt.userChoice;
      } catch {}
      setDeferredPrompt(null);
      setCanInstall(false);
    }
  }

  if (dismissed || isStandalone || !isWebMobile) return null;

  const ios = isIOS();

  return (
    <Card className="gap-4 border-primary/20 bg-primary/10">
      <View className="flex-row items-start justify-between gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary">
          <Smartphone size={20} color="#0F172A" strokeWidth={2.2} />
        </View>
        <View className="flex-1 gap-1">
          <Text className="font-inter-bold text-base text-foreground">Installa FitTrack</Text>
          <Text className="font-sans text-sm leading-5 text-muted">Aggiungi l'app alla schermata Home per usarla come nativa (niente più sola lettura).</Text>
        </View>
        <Pressable onPress={handleDismiss} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-full bg-surface active:opacity-60">
          <X size={14} color="#94A3B8" strokeWidth={2.5} />
        </Pressable>
      </View>

      {canInstall && !ios ? (
        <Pressable onPress={handleInstall} className="flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3 active:opacity-80">
          <Download size={16} color="#0F172A" strokeWidth={2.2} />
          <Text className="font-inter-bold text-sm text-primary-foreground">Installa ora</Text>
        </Pressable>
      ) : null}

      <View className="gap-3 rounded-xl bg-surface p-3">
        {ios ? (
          <View className="gap-2">
            <View className="flex-row items-center gap-1.5">
              <Text className="font-inter-semibold text-sm text-foreground">iPhone / iPad (Safari)</Text>
              <Text className="font-sans text-xs text-muted">— iOS</Text>
            </View>
            <View className="flex-row items-start gap-2">
              <View className="mt-0.5 h-6 w-6 items-center justify-center rounded-full bg-background">
                <Share size={12} color="#F97316" strokeWidth={2.2} />
              </View>
              <Text className="flex-1 font-sans text-sm leading-5 text-muted">
                Tocca <Text className="font-inter-semibold text-foreground">Condividi</Text> (quadrato con freccia) in basso → <Text className="font-inter-semibold text-foreground">Aggiungi a Home</Text> → <Text className="font-inter-semibold text-foreground">Aggiungi</Text>
              </Text>
            </View>
          </View>
        ) : (
          <View className="gap-2">
            <View className="flex-row items-center gap-1.5">
              <Text className="font-inter-semibold text-sm text-foreground">Android (Chrome)</Text>
              <Text className="font-sans text-xs text-muted">— Android</Text>
            </View>
            <View className="flex-row items-start gap-2">
              <View className="mt-0.5 h-6 w-6 items-center justify-center rounded-full bg-background">
                <Text className="font-inter-bold text-xs text-foreground">⋮</Text>
              </View>
              <Text className="flex-1 font-sans text-sm leading-5 text-muted">
                Tocca <Text className="font-inter-semibold text-foreground">⋮</Text> in alto a destra → <Text className="font-inter-semibold text-foreground">Installa app</Text> / <Text className="font-inter-semibold text-foreground">Aggiungi a schermata Home</Text> → <Text className="font-inter-semibold text-foreground">Installa</Text>
              </Text>
            </View>
          </View>
        )}

        {/* Mostra sempre l'altra piattaforma come secondaria, compatta */}
        <View className="h-px bg-border" />
        <Text className="font-sans text-xs leading-4 text-muted">
          {ios ? "Su Android: menu ⋮ → Installa app" : "Su iPhone: Condividi → Aggiungi a Home"} — dopo l'installazione l'app si apre a schermo intero con tutte le funzioni sbloccate.
        </Text>
      </View>
    </Card>
  );
}
