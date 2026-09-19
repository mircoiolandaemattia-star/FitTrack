import AsyncStorage from "@react-native-async-storage/async-storage";

/** Legge una stringa da AsyncStorage (mai throw). */
export async function getItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Scrive una stringa in AsyncStorage. */
export async function setItem(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value);
}

/** Rimuove una chiave da AsyncStorage. */
export async function removeItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

/** Legge e deserializza un valore JSON. */
export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Serializza e scrive un valore JSON. */
export async function setJson<T>(key: string, value: T): Promise<void> {
  await setItem(key, JSON.stringify(value));
}