import type { Card, TimelineEntry } from "./types.js";

/**
 * Insert a card into a timeline at the specified slot index
 * Creates a new timeline array (immutable)
 */
export function insertCard(
  timeline: TimelineEntry[],
  card: Card,
  slotIndex: number,
  playerId: string
): TimelineEntry[] {
  const newEntry: TimelineEntry = {
    card,
    playerId,
    slotIndex,
  };

  // If timeline is empty, just add the entry
  if (timeline.length === 0) {
    return [newEntry];
  }

  // Validate slot index
  if (slotIndex < 0 || slotIndex > timeline.length) {
    throw new Error(`Invalid slot index: ${slotIndex}. Must be between 0 and ${timeline.length}`);
  }

  // Insert at the specified position
  const newTimeline = [...timeline];
  newTimeline.splice(slotIndex, 0, newEntry);

  // Update slot indices for all entries after the insertion point
  return newTimeline.map((entry, index) => ({
    ...entry,
    slotIndex: index,
  }));
}

/**
 * Validate that a placement slot index is valid for the given timeline
 */
export function validatePlacement(timeline: TimelineEntry[], slotIndex: number): boolean {
  if (slotIndex < 0) {
    return false;
  }
  if (timeline.length === 0) {
    return slotIndex === 0;
  }
  return slotIndex <= timeline.length;
}

/**
 * Check if a placement is correct by comparing the slot index position
 * with the actual year relative to other timeline entries.
 * This checks if placing a card with actualYear at slotIndex would be chronologically correct.
 */
export function isCorrectPlacement(
  timeline: TimelineEntry[],
  slotIndex: number,
  actualYear: number
): boolean {
  if (timeline.length === 0) {
    return true; // First card is always correct
  }

  // Validate slot index
  if (slotIndex < 0 || slotIndex > timeline.length) {
    return false;
  }

  // Find the entry that would be before and after this slot
  // The timeline should be sorted by slotIndex
  const sortedTimeline = getSortedTimeline(timeline);

  // Find entries that would be before and after this slot
  let prevEntry: TimelineEntry | undefined;
  let nextEntry: TimelineEntry | undefined;

  for (const entry of sortedTimeline) {
    if (entry.slotIndex < slotIndex) {
      prevEntry = entry;
    } else if (entry.slotIndex >= slotIndex && !nextEntry) {
      nextEntry = entry;
      break;
    }
  }

  // Check chronological correctness
  // If placing at the beginning (no prev), actualYear should be <= nextEntry.year (if exists)
  // If placing at the end (no next), actualYear should be >= prevEntry.year (if exists)
  // If placing in the middle, actualYear should be >= prevEntry.year and <= nextEntry.year
  const isAfterPrev =
    !prevEntry || (prevEntry.year !== undefined && prevEntry.year <= actualYear);
  const isBeforeNext =
    !nextEntry || (nextEntry.year !== undefined && nextEntry.year >= actualYear);

  return isAfterPrev && isBeforeNext;
}

/**
 * Get all timeline entries sorted by slot index
 */
export function getSortedTimeline(timeline: TimelineEntry[]): TimelineEntry[] {
  return [...timeline].sort((a, b) => a.slotIndex - b.slotIndex);
}

