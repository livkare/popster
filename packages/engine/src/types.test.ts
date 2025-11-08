import { describe, it, expect } from "vitest";
import type { GameMode, GameStatus, Card, Player, TimelineEntry, Round, GameState } from "./types.js";

describe("Types", () => {
  it("should have valid GameMode types", () => {
    const modes: GameMode[] = ["original", "pro", "expert", "coop"];
    expect(modes.length).toBe(4);
  });

  it("should have valid GameStatus types", () => {
    const statuses: GameStatus[] = ["lobby", "playing", "round_summary", "finished"];
    expect(statuses.length).toBe(4);
  });

  it("should create a valid Card", () => {
    const card: Card = {
      trackUri: "spotify:track:abc123",
      revealed: false,
    };
    expect(card.trackUri).toBe("spotify:track:abc123");
    expect(card.revealed).toBe(false);
  });

  it("should create a valid Player", () => {
    const player: Player = {
      id: "player-1",
      name: "Alice",
      avatar: "avatar1",
      tokens: 3,
      score: 0,
    };
    expect(player.id).toBe("player-1");
    expect(player.tokens).toBe(3);
  });

  it("should create a valid TimelineEntry", () => {
    const entry: TimelineEntry = {
      card: { trackUri: "spotify:track:abc123", revealed: false },
      playerId: "player-1",
      slotIndex: 0,
    };
    expect(entry.slotIndex).toBe(0);
  });

  it("should create a valid Round", () => {
    const round: Round = {
      roundNumber: 1,
      currentCard: { trackUri: "spotify:track:abc123", revealed: false },
      placements: [],
      revealed: false,
    };
    expect(round.roundNumber).toBe(1);
  });

  it("should create a valid GameState", () => {
    const state: GameState = {
      mode: "original",
      status: "lobby",
      players: [],
      currentRound: 0,
      rounds: [],
      winner: null,
      startingTokens: 3,
    };
    expect(state.mode).toBe("original");
    expect(state.status).toBe("lobby");
  });
});

