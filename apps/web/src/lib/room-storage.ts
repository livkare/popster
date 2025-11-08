/**
 * LocalStorage persistence for room and player state
 * Persists roomKey, isHost, playerName, and playerAvatar across page reloads
 */

const STORAGE_KEY = "hitster-room-state";

interface PersistedRoomState {
  roomKey: string;
  isHost: boolean;
  playerName: string;
  playerAvatar: string;
  playerId?: string; // Optional, for reference
}

/**
 * Save room state to localStorage
 */
export function saveRoomState(state: PersistedRoomState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save room state to localStorage:", error);
  }
}

/**
 * Get persisted room state from localStorage
 */
export function getRoomState(): PersistedRoomState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as PersistedRoomState;
  } catch (error) {
    console.error("Failed to get room state from localStorage:", error);
    return null;
  }
}

/**
 * Clear persisted room state from localStorage
 */
export function clearRoomState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear room state from localStorage:", error);
  }
}

/**
 * Update playerId in persisted state
 */
export function updatePlayerId(playerId: string): void {
  const state = getRoomState();
  if (state) {
    saveRoomState({ ...state, playerId });
  }
}

