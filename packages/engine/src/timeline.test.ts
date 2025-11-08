import { describe, it, expect } from "vitest";
import {
  insertCard,
  validatePlacement,
  isCorrectPlacement,
  getSortedTimeline,
} from "./timeline.js";
import type { Card, TimelineEntry } from "./types.js";

describe("Timeline", () => {
  const createCard = (trackUri: string, year?: number): Card => ({
    trackUri,
    year,
    revealed: false,
  });

  describe("insertCard", () => {
    it("should insert card into empty timeline", () => {
      const timeline: TimelineEntry[] = [];
      const card = createCard("spotify:track:1");
      const result = insertCard(timeline, card, 0, "player-1");

      expect(result.length).toBe(1);
      expect(result[0].card.trackUri).toBe("spotify:track:1");
      expect(result[0].playerId).toBe("player-1");
      expect(result[0].slotIndex).toBe(0);
    });

    it("should insert card at the beginning", () => {
      const timeline: TimelineEntry[] = [
        {
          card: createCard("spotify:track:1", 2000),
          playerId: "player-1",
          slotIndex: 0,
        },
      ];
      const card = createCard("spotify:track:2");
      const result = insertCard(timeline, card, 0, "player-2");

      expect(result.length).toBe(2);
      expect(result[0].card.trackUri).toBe("spotify:track:2");
      expect(result[0].slotIndex).toBe(0);
      expect(result[1].slotIndex).toBe(1);
    });

    it("should insert card at the end", () => {
      const timeline: TimelineEntry[] = [
        {
          card: createCard("spotify:track:1", 2000),
          playerId: "player-1",
          slotIndex: 0,
        },
      ];
      const card = createCard("spotify:track:2");
      const result = insertCard(timeline, card, 1, "player-2");

      expect(result.length).toBe(2);
      expect(result[1].card.trackUri).toBe("spotify:track:2");
      expect(result[1].slotIndex).toBe(1);
    });

    it("should insert card in the middle", () => {
      const timeline: TimelineEntry[] = [
        {
          card: createCard("spotify:track:1", 2000),
          playerId: "player-1",
          slotIndex: 0,
        },
        {
          card: createCard("spotify:track:2", 2010),
          playerId: "player-1",
          slotIndex: 1,
        },
      ];
      const card = createCard("spotify:track:3");
      const result = insertCard(timeline, card, 1, "player-2");

      expect(result.length).toBe(3);
      expect(result[1].card.trackUri).toBe("spotify:track:3");
      expect(result[0].slotIndex).toBe(0);
      expect(result[1].slotIndex).toBe(1);
      expect(result[2].slotIndex).toBe(2);
    });

    it("should update slot indices correctly", () => {
      const timeline: TimelineEntry[] = [
        {
          card: createCard("spotify:track:1", 2000),
          playerId: "player-1",
          slotIndex: 0,
        },
        {
          card: createCard("spotify:track:2", 2010),
          playerId: "player-1",
          slotIndex: 1,
        },
      ];
      const card = createCard("spotify:track:3");
      const result = insertCard(timeline, card, 0, "player-2");

      expect(result[0].slotIndex).toBe(0);
      expect(result[1].slotIndex).toBe(1);
      expect(result[2].slotIndex).toBe(2);
    });

    it("should throw error for invalid slot index (negative)", () => {
      const timeline: TimelineEntry[] = [
        {
          card: createCard("spotify:track:1"),
          playerId: "player-1",
          slotIndex: 0,
        },
      ];
      const card = createCard("spotify:track:2");

      expect(() => insertCard(timeline, card, -1, "player-2")).toThrow();
    });

    it("should throw error for invalid slot index (too large)", () => {
      const timeline: TimelineEntry[] = [
        {
          card: createCard("spotify:track:1"),
          playerId: "player-1",
          slotIndex: 0,
        },
      ];
      const card = createCard("spotify:track:2");

      expect(() => insertCard(timeline, card, 10, "player-2")).toThrow();
    });
  });

  describe("validatePlacement", () => {
    it("should validate placement in empty timeline", () => {
      expect(validatePlacement([], 0)).toBe(true);
    });

    it("should reject negative slot index", () => {
      expect(validatePlacement([], -1)).toBe(false);
    });

    it("should validate placement at the end of timeline", () => {
      const timeline: TimelineEntry[] = [
        {
          card: createCard("spotify:track:1"),
          playerId: "player-1",
          slotIndex: 0,
        },
      ];
      expect(validatePlacement(timeline, 1)).toBe(true);
    });

    it("should validate placement in the middle", () => {
      const timeline: TimelineEntry[] = [
        {
          card: createCard("spotify:track:1"),
          playerId: "player-1",
          slotIndex: 0,
        },
        {
          card: createCard("spotify:track:2"),
          playerId: "player-1",
          slotIndex: 1,
        },
      ];
      expect(validatePlacement(timeline, 1)).toBe(true);
    });

    it("should reject slot index beyond timeline length", () => {
      const timeline: TimelineEntry[] = [
        {
          card: createCard("spotify:track:1"),
          playerId: "player-1",
          slotIndex: 0,
        },
      ];
      expect(validatePlacement(timeline, 2)).toBe(false);
    });
  });

  describe("isCorrectPlacement", () => {
    it("should return true for first card in empty timeline", () => {
      expect(isCorrectPlacement([], 0, 2000)).toBe(true);
    });

    it("should validate correct placement between years", () => {
      const timeline: TimelineEntry[] = [
        {
          card: createCard("spotify:track:1", 2000),
          playerId: "player-1",
          slotIndex: 0,
          year: 2000,
        },
        {
          card: createCard("spotify:track:2", 2010),
          playerId: "player-1",
          slotIndex: 1,
          year: 2010,
        },
      ];
      expect(isCorrectPlacement(timeline, 1, 2005)).toBe(true);
    });

    it("should validate correct placement at the beginning", () => {
      const timeline: TimelineEntry[] = [
        {
          card: createCard("spotify:track:1", 2010),
          playerId: "player-1",
          slotIndex: 0,
          year: 2010,
        },
      ];
      expect(isCorrectPlacement(timeline, 0, 2005)).toBe(true);
    });

    it("should validate correct placement at the end", () => {
      const timeline: TimelineEntry[] = [
        {
          card: createCard("spotify:track:1", 2000),
          playerId: "player-1",
          slotIndex: 0,
          year: 2000,
        },
      ];
      expect(isCorrectPlacement(timeline, 1, 2010)).toBe(true);
    });

    it("should reject incorrect placement (too early)", () => {
      const timeline: TimelineEntry[] = [
        {
          card: createCard("spotify:track:1", 2010),
          playerId: "player-1",
          slotIndex: 0,
          year: 2010,
        },
      ];
      expect(isCorrectPlacement(timeline, 0, 2020)).toBe(false);
    });

    it("should reject incorrect placement (too late)", () => {
      const timeline: TimelineEntry[] = [
        {
          card: createCard("spotify:track:1", 2010),
          playerId: "player-1",
          slotIndex: 0,
          year: 2010,
        },
      ];
      expect(isCorrectPlacement(timeline, 1, 2000)).toBe(false);
    });

    it("should handle equal years correctly", () => {
      const timeline: TimelineEntry[] = [
        {
          card: createCard("spotify:track:1", 2000),
          playerId: "player-1",
          slotIndex: 0,
          year: 2000,
        },
      ];
      expect(isCorrectPlacement(timeline, 1, 2000)).toBe(true);
    });
  });

  describe("getSortedTimeline", () => {
    it("should return sorted timeline by slot index", () => {
      const timeline: TimelineEntry[] = [
        {
          card: createCard("spotify:track:2"),
          playerId: "player-1",
          slotIndex: 2,
        },
        {
          card: createCard("spotify:track:0"),
          playerId: "player-1",
          slotIndex: 0,
        },
        {
          card: createCard("spotify:track:1"),
          playerId: "player-1",
          slotIndex: 1,
        },
      ];
      const sorted = getSortedTimeline(timeline);

      expect(sorted[0].slotIndex).toBe(0);
      expect(sorted[1].slotIndex).toBe(1);
      expect(sorted[2].slotIndex).toBe(2);
    });

    it("should not mutate original timeline", () => {
      const timeline: TimelineEntry[] = [
        {
          card: createCard("spotify:track:2"),
          playerId: "player-1",
          slotIndex: 2,
        },
        {
          card: createCard("spotify:track:0"),
          playerId: "player-1",
          slotIndex: 0,
        },
      ];
      const original = [...timeline];
      getSortedTimeline(timeline);

      expect(timeline).toEqual(original);
    });
  });
});

