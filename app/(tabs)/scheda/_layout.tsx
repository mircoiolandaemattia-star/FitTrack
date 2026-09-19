import { Stack } from "expo-router";

/**
 * Stack della sezione Scheda: la lista settimanale (index) e l'allenamento
 * attivo (allenamento/[dayId]) vivono dentro la stessa tab. Senza questo
 * layout, expo-router esporrebbe "scheda/allenamento/[dayId]" come tab
 * separata nella barra: qui viene incapsulato come pagina interna.
 */
export default function SchedaLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Sfondo scuro anche durante le transizioni native.
        contentStyle: { backgroundColor: "#0F172A" },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="allenamento/[dayId]" />
    </Stack>
  );
}