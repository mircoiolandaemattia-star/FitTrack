import { Redirect } from "expo-router";

/**
 * Route radice: il redirect effettivo è gestito dal guard in _layout.tsx
 * (login se non autenticato, onboarding al primo accesso, altrimenti le tab).
 */
export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}