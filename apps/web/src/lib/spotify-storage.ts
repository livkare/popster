/**
 * IndexedDB storage for Spotify tokens
 * Only accessible from host tab
 */

const DB_NAME = "hitster-spotify";
const DB_VERSION = 1;
const STORE_NAME = "tokens";

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Open IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Failed to open IndexedDB"));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Save tokens to IndexedDB
 */
export async function saveTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const expiresAt = Date.now() + expiresIn * 1000;
    const data: TokenData = {
      accessToken,
      refreshToken,
      expiresAt,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(data, "tokens");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("Failed to save tokens"));
    });

    db.close();
  } catch (error) {
    console.error("Failed to save tokens:", error);
    throw error;
  }
}

/**
 * Get tokens from IndexedDB
 */
export async function getTokens(): Promise<TokenData | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);

    const data = await new Promise<TokenData | null>((resolve, reject) => {
      const request = store.get("tokens");
      request.onsuccess = () => {
        const result = request.result as TokenData | undefined;
        if (result && result.expiresAt > Date.now()) {
          resolve(result);
        } else {
          resolve(null); // Tokens expired or not found
        }
      };
      request.onerror = () => reject(new Error("Failed to get tokens"));
    });

    db.close();
    return data;
  } catch (error) {
    console.error("Failed to get tokens:", error);
    return null;
  }
}

/**
 * Clear tokens from IndexedDB
 */
export async function clearTokens(): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete("tokens");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("Failed to clear tokens"));
    });

    db.close();
  } catch (error) {
    console.error("Failed to clear tokens:", error);
    throw error;
  }
}

