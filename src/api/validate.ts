import { z } from "zod";

/** Id generati da Prisma (`@default(uuid())`). */
export const idSchema = z.uuid();

/**
 * Valida un input con zod e lancia `ZodError` se non valido:
 * l'adapter degli errori la trasforma in 400 VALIDATION_ERROR,
 * quindi ogni handler scrive solo lo schema.
 */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw result.error;
  return result.data as z.output<S>;
}
