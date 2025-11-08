/**
 * Shared utilities for room key validation
 */

const ROOM_KEY_PATTERN = /^[A-Z0-9]{6}$/;

/**
 * Validates a room key format
 * @param roomKey - The room key to validate
 * @returns true if the room key is valid, false otherwise
 */
export function isValidRoomKeyFormat(roomKey: string | undefined): boolean {
  if (!roomKey) {
    return false;
  }
  return ROOM_KEY_PATTERN.test(roomKey);
}

/**
 * Normalizes a room key to uppercase
 * @param roomKey - The room key to normalize
 * @returns The normalized room key
 */
export function normalizeRoomKey(roomKey: string): string {
  return roomKey.toUpperCase().slice(0, 6);
}

