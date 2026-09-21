import { useEffect, useState } from "react";

/**
 * Rileva se l'app gira come PWA installata (standalone).
 * Su browser normale ritorna false → sola lettura.
 * Su PWA installata (o dev build) ritorna true → funzionamento nativo.
 */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const check = () => {
      const mql = window.matchMedia?.("(display-mode: standalone)");
      const isStandalone =
        mql?.matches ||
        // iOS Safari
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        // Fallback: window controls overlay (Chrome PWA)
        window.matchMedia?.("(display-mode: window-controls-overlay)").matches ||
        false;
      setStandalone(isStandalone);
    };

    check();
    const mql = window.matchMedia?.("(display-mode: standalone)");
    const handler = () => check();
    try {
      mql?.addEventListener?.("change", handler);
    } catch {
      // Safari < 14 fallback
      mql?.addListener?.(handler as unknown as Parameters<NonNullable<typeof mql>["addListener"]>[0]);
    }
    return () => {
      try {
        mql?.removeEventListener?.("change", handler);
      } catch {
        mql?.removeListener?.(handler as unknown as Parameters<NonNullable<typeof mql>["removeListener"]>[0]);
      }
    };
  }, []);

  return standalone;
}
