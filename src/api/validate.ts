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

/** Solo "YYYY-MM-DD": data senza orario (diventa mezzanotte UTC). */
export const dateSchema = z.iso.date();

/**
 * Timestamp ISO 8601 **con** zona ("2026-09-28T18:00:00Z" o "...+02:00"),
 * convertito in `Date` così gli handler non devono ricastare l'input.
 */
export const dateTimeSchema = z
  .iso.datetime({ offset: true })
  .transform((value) => new Date(value));

/**
 * Range opzionale `from`/`to` (entrambe "YYYY-MM-DD") per le liste cronologiche.
 * `from > to` è un errore di validazione, non un risultato vuoto silenzioso.
 */
export const rangeQuerySchema = z
  .object({ from: dateSchema.optional(), to: dateSchema.optional() })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "'from' non può essere successivo di 'to'.",
  });
