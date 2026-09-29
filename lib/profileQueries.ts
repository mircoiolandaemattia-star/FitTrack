import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "./api";
import type { ActivityLevel, Goal } from "./calorieCalculator";

/**
 * Riga `users` restituita dall'API (snake_case, come il DB):
 * una sola riga per utente, non esiste un `:id`.
 */
export interface ApiProfile {
  id: string;
  email: string;
  name: string;
  birth_date: string | null;
  gender: "male" | "female" | "other" | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal: string;
  activity_level: string;
  daily_calorie_target: number | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;
  subscription_status: string;
  subscription_expires_at: string | null;
  created_at: string;
}

/** Corpo di POST /api/users: solo dati del profilo, l'identità è nel token. */
export interface CreateProfileInput {
  name: string;
  birth_date: string;
  gender: "male" | "female" | "other";
  height_cm: number;
  weight_kg: number;
  goal: "lose" | "maintain" | "gain";
  activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active";
}

/** Enum dell'app → enum del backend (i due dizionari non coincidono). */
export const GOAL_TO_API: Record<Goal, CreateProfileInput["goal"]> = {
  dimagrire: "lose",
  mantenimento: "maintain",
  massa: "gain",
};

export const ACTIVITY_TO_API: Record<ActivityLevel, CreateProfileInput["activity_level"]> = {
  sedentary: "sedentary",
  light: "light",
  moderate: "moderate",
  high: "active",
};

/**
 * L'onboarding raccoglie l'età anagrafica, il backend vuole `birth_date`:
 * deriviamo il 1° gennaio dell'anno (oggi − età). La precisione è annuale,
 * che è esattamente la precisione usata dal calcolo TDEE.
 */
export function birthDateFromAge(age: number): string {
  return `${new Date().getFullYear() - age}-01-01`;
}

export const profileKeys = {
  /** Una riga per utente: una sola chiave, invalidata al login/onboarding. */
  me: ["profile", "me"] as const,
};

/** 404 su GET /users/me = onboarding non completato (non un errore di rete). */
export function isProfileMissing(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

/**
 * Profilo dell'utente autenticato. Il 404 è atteso al primo avvio (riga
 * inesistente): viene gestito dal guard di navigazione, non ritentato.
 */
export function useProfile(enabled = true) {
  return useQuery({
    queryKey: profileKeys.me,
    queryFn: () => api.get<ApiProfile>("/users/me"),
    enabled,
    // Gli errori HTTP 4xx sono risposte, non intoppi: mai in retry.
    retry: (failureCount, error) =>
      isApiError(error) ? error.status >= 500 && failureCount < 1 : failureCount < 2,
  });
}

/** Crea la riga profilo (POST /api/users) e aggiorna subito la cache. */
export function useCreateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProfileInput) => api.post<ApiProfile>("/users", input),
    onSuccess: (profile) => {
      // Annulla il 404 appena letto e ri-verifica col server.
      queryClient.setQueryData(profileKeys.me, profile);
      void queryClient.invalidateQueries({ queryKey: profileKeys.me });
    },
  });
}

/** PUT /api/users/me: aggiorna obiettivo/attività/dati personali (ricalcola TDEE lato server). */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<CreateProfileInput>) => api.put<ApiProfile>("/users/me", patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.me });
    },
  });
}
