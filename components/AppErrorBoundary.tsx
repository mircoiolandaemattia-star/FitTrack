import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { setItem } from "@/lib/storage";

/** Chiave dove l'errore viene copiato, così sopravvive a un riavvio. */
const STORE_KEY = "fittrack_diag_render_error";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
  componentStack: string;
};

/**
 * Bordatura attorno a tutto l'albero.
 *
 * Senza un error boundary qualsiasi errore di render in Release diventa
 * fatale: React lo segnala come "uncaught" e React Native termina il
 * processo (`reportFatal` → `abort()`), a schermo non compare nulla.
 * Con il bordo l'errore resta catturato, non fatali e — soprattutto —
 * viene MOSTRATO con stack e componentStack.
 *
 * Lo stile è inline (mai classi NativeWind): se il guasto riguardasse
 * proprio NativeWind, il fallback dovrebbe comunque disegnarsi.
 */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null, componentStack: "" };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const componentStack = info.componentStack ?? "";
    this.setState({ componentStack });
    const text = `${error.name}: ${error.message}\n\n${error.stack ?? ""}${
      componentStack ? `\n\ncomponentStack:${componentStack}` : ""
    }`;
    // Best effort: se la scrittura fallisce resta comunque lo schermo.
    void setItem(STORE_KEY, text).catch(() => {});
  }

  private handleRetry = (): void => {
    this.setState({ error: null, componentStack: "" });
  };

  render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={{ flex: 1, backgroundColor: "#0F172A", paddingTop: 64, paddingHorizontal: 16 }}>
        <Text style={{ color: "#F97316", fontSize: 22, fontWeight: "700", marginBottom: 8 }}>
          Errore nell&apos;applicazione
        </Text>
        <Text style={{ color: "#94A3B8", fontSize: 13, marginBottom: 12 }}>
          L&apos;errore è stato intercettato: l&apos;app non è crashata. Incolalo qui sotto.
        </Text>
        <ScrollView
          style={{ flex: 1, backgroundColor: "#020617", borderRadius: 12, padding: 12 }}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          <Text selectable style={{ color: "#E2E8F0", fontSize: 12, fontFamily: "monospace" }}>
            {`${error.name}: ${error.message}\n\n${error.stack ?? ""}${
              componentStack ? `\n\ncomponentStack:${componentStack}` : ""
            }`}
          </Text>
        </ScrollView>
        <Pressable
          onPress={this.handleRetry}
          accessibilityRole="button"
          style={{
            marginTop: 16,
            marginBottom: 32,
            backgroundColor: "#F97316",
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#0F172A", fontSize: 16, fontWeight: "700" }}>Riprova</Text>
        </Pressable>
      </View>
    );
  }
}
