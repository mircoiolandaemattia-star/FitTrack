import type { DocumentPickerAsset } from "expo-document-picker";

/**
 * Lettura di un file selezionato con `expo-document-picker` come base64,
 * nel formato che `POST /api/ai/file-read` si aspetta.
 *
 * - **Web** (PWA): l'asset porta già `base64`/`File`, niente filesystem.
 * - **Native**: l'asset è un `file://` → `expo-file-system` (API legacy).
 *
 * Il backend limita il corpo a 8 MB: il base64 gonfia il file di circa
 * un terzo, quindi il tetto di qui è 5 MB (il messaggio dice chiaro).
 */
const MAX_BYTES = 5 * 1024 * 1024;

/** Solo i formati accettati dall'enum `mime_type` del backend. */
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Errore "da mostrare all'utente": il testo è già in italiano. */
export class DocumentReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentReadError";
  }
}

/** MIME type del documento; formati non supportati → errore leggibile. */
export function documentMimeType(asset: Pick<DocumentPickerAsset, "name" | "mimeType">): string {
  const declared = asset.mimeType?.split(";")[0].trim().toLowerCase();
  if (declared && declared !== "application/octet-stream") {
    if (declared === "image/jpg") return "image/jpeg";
    if (Object.values(MIME_BY_EXTENSION).includes(declared)) return declared;
    throw new DocumentReadError(
      `Formato "${declared}" non supportato: usa un PDF o un'immagine JPEG, PNG o WebP.`,
    );
  }
  const extension = asset.name.split(".").pop()?.toLowerCase() ?? "";
  const inferred = MIME_BY_EXTENSION[extension];
  if (!inferred) {
    throw new DocumentReadError(
      "Formato non riconosciuto: usa un PDF o un'immagine JPEG, PNG o WebP.",
    );
  }
  return inferred;
}

/** Base64 del file (con o senza prefisso `data:...;base64,`). */
export async function readDocumentBase64(asset: DocumentPickerAsset): Promise<string> {
  if (asset.size != null && asset.size > MAX_BYTES) {
    throw new DocumentReadError(
      `Il file è troppo grande (${Math.round(asset.size / (1024 * 1024))} MB): il limite è 5 MB.`,
    );
  }

  // Web: `expo-document-picker` decodifica già il file.
  if (asset.base64) return asset.base64;
  const file = asset.file;
  if (file && typeof FileReader !== "undefined") {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new DocumentReadError("Non sono riuscito a leggere il file selezionato."));
          return;
        }
        resolve(result);
      };
      reader.onerror = () =>
        reject(new DocumentReadError("Non sono riuscito a leggere il file selezionato."));
      reader.readAsDataURL(file);
    });
  }

  // Native: uri file:// → FileSystem.
  try {
    const FileSystem = await import("expo-file-system/legacy");
    return await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    throw new DocumentReadError("Non sono riuscito a leggere il file selezionato.");
  }
}
