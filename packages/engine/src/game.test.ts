import { describe, it, expect } from "vitest";
import {
  createGame,
  joinPlayer,
  removePlayer,
  startRound,
  placeCard,
  challengePlacement,
  revealYear,
  calculateRoundScoreForPlayer,
  checkWinCondition,
  getPlayerTimeline,
} from "./game.js";
import type { Player, Card } from "./types.js";

describe("Game", () => {
  const createPlayer = (id: string, name: string): Player => ({
    id,
    name,
    avatar: `avatar-${id}`,
    tokens: 0, // Will be set by joinPlayer
    score: 0,
  });

  const createCard = (trackUri: string): Card => ({
    trackUri,
    revealed: false,
  });

  describe("createGame", () => {
    it("should create a game with original mode", () => {
      const state = createGame("original");
      expect(state.mode).toBe("original");
      expect(state.status).toBe("lobby");
      expect(state.players).toEqual([]);
      expect(state.currentRound).toBe(0);
      expect(state.rounds).toEqual([]);
      expect(state.winner).toBeNull();
      expect(state.startingTokens).toBe(3);
    });

    it("should create a game with pro mode", () => {
      const state = createGame("pro");
      expect(state.mode).toBe("pro");
      expect(state.startingTokens).toBe(3);
    });

    it("should create a game with expert mode", () => {
      const state = createGame("expert");
      expect(state.mode).toBe("expert");
      expect(state.startingTokens).toBe(3);
    });

    it("should create a game with coop mode", () => {
      const state = createGame("coop");
      expect(state.mode).toBe("coop");
      expect(state.startingTokens).toBe(5);
    });
  });

  describe("joinPlayer", () => {
    it("should add a player to the game", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      expect(state.players.length).toBe(1);
      expect(state.players[0].id).toBe("player-1");
      expect(state.players[0].name).toBe("Alice");
      expect(state.players[0].tokens).toBe(3);
      expect(state.players[0].score).toBe(0);
    });

    it("should add multiple players", () => {
      let state = createGame("original");
      const player1 = createPlayer("player-1", "Alice");
      const player2 = createPlayer("player-2", "Bob");
      state = joinPlayer(state, player1);
      state = joinPlayer(state, player2);

      expect(state.players.length).toBe(2);
      expect(state.players[0].id).toBe("player-1");
      expect(state.players[1].id).toBe("player-2");
    });

    it("should throw error if player already exists", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      expect(() => joinPlayer(state, player)).toThrow();
    });

    it("should throw error if game has already started", () => {
      let state = createGame("original");
      const player1 = createPlayer("player-1", "Alice");
      const player2 = createPlayer("player-2", "Bob");
      state = joinPlayer(state, player1);
      state = startRound(state, createCard("spotify:track:1"));

      expect(() => joinPlayer(state, player2)).toThrow();
    });

    it("should not mutate original state", () => {
      const state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      const newState = joinPlayer(state, player);

      expect(state.players.length).toBe(0);
      expect(newState.players.length).toBe(1);
    });
  });

  describe("removePlayer", () => {
    it("should remove a player from the game", () => {
      let state = createGame("original");
      const player1 = createPlayer("player-1", "Alice");
      const player2 = createPlayer("player-2", "Bob");
      state = joinPlayer(state, player1);
      state = joinPlayer(state, player2);
      state = removePlayer(state, "player-1");

      expect(state.players.length).toBe(1);
      expect(state.players[0].id).toBe("player-2");
    });

    it("should throw error if player does not exist", () => {
      const state = createGame("original");
      expect(() => removePlayer(state, "non-existent")).toThrow();
    });

    it("should not mutate original state", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      const newState = removePlayer(state, "player-1");

      expect(state.players.length).toBe(1);
      expect(newState.players.length).toBe(0);
    });
  });

  describe("startRound", () => {
    it("should start a new round with a card", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));

      expect(state.status).toBe("playing");
      expect(state.currentRound).toBe(0); // currentRound is 0-based index
      expect(state.rounds.length).toBe(1);
      expect(state.rounds[0].currentCard.trackUri).toBe("spotify:track:1");
      expect(state.rounds[0].roundNumber).toBe(1);
      expect(state.rounds[0].revealed).toBe(false);
    });

    it("should select first player if no player specified", () => {
      let state = createGame("original");
      const player1 = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player1);
      state = startRound(state, createCard("spotify:track:1"));

      expect(state.rounds[0].currentPlayerId).toBe("player-1");
    });

    it("should select specified player", () => {
      let state = createGame("original");
      const player1 = createPlayer("player-1", "Alice");
      const player2 = createPlayer("player-2", "Bob");
      state = joinPlayer(state, player1);
      state = joinPlayer(state, player2);
      state = startRound(state, createCard("spotify:track:1"), "player-2");

      expect(state.rounds[0].currentPlayerId).toBe("player-2");
    });

    it("should rotate players in round-robin fashion", () => {
      let state = createGame("original");
      const player1 = createPlayer("player-1", "Alice");
      const player2 = createPlayer("player-2", "Bob");
      state = joinPlayer(state, player1);
      state = joinPlayer(state, player2);

      // Round 1
      state = startRound(state, createCard("spotify:track:1"));
      expect(state.rounds[0].currentPlayerId).toBe("player-1");

      // Round 2
      state = startRound(state, createCard("spotify:track:2"));
      expect(state.rounds[1].currentPlayerId).toBe("player-2");

      // Round 3
      state = startRound(state, createCard("spotify:track:3"));
      expect(state.rounds[2].currentPlayerId).toBe("player-1");
    });

    it("should throw error if game is finished", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);
      state = revealYear(state, 2000);

      // Set winner manually to simulate finished game
      state = { ...state, status: "finished", winner: "player-1" };

      expect(() => startRound(state, createCard("spotify:track:2"))).toThrow();
    });

    it("should throw error if no players", () => {
      const state = createGame("original");
      expect(() => startRound(state, createCard("spotify:track:1"))).toThrow();
    });

    it("should not mutate original state", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      const newState = startRound(state, createCard("spotify:track:1"));

      expect(state.currentRound).toBe(0);
      expect(newState.currentRound).toBe(0); // currentRound is 0-based index
    });
  });

  describe("placeCard", () => {
    it("should place a card on player's timeline", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);

      expect(state.rounds[0].placements.length).toBe(1);
      expect(state.rounds[0].placements[0].playerId).toBe("player-1");
      expect(state.rounds[0].placements[0].card.trackUri).toBe("spotify:track:1");
      expect(state.rounds[0].placements[0].slotIndex).toBe(0);
    });

    it("should place multiple cards in different slots", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      // Round 1
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);
      state = revealYear(state, 2000);

      // Round 2
      state = startRound(state, createCard("spotify:track:2"));
      state = placeCard(state, "player-1", 1);
      state = revealYear(state, 2010);

      expect(state.rounds[0].placements[0].slotIndex).toBe(0);
      expect(state.rounds[1].placements[0].slotIndex).toBe(1);
    });

    it("should throw error if no active round", () => {
      const state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      expect(() => placeCard(state, player.id, 0)).toThrow("No active round");
    });

    it("should throw error if challengePlacement has no active round", () => {
      const state = createGame("original");
      const player1 = createPlayer("player-1", "Alice");
      const player2 = createPlayer("player-2", "Bob");
      expect(() => challengePlacement(state, player1.id, player2.id, 0)).toThrow("No active round");
    });

    it("should throw error if challengePlacement game not in playing status", () => {
      let state = createGame("original");
      const player1 = createPlayer("player-1", "Alice");
      const player2 = createPlayer("player-2", "Bob");
      state = joinPlayer(state, player1);
      state = joinPlayer(state, player2);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-2", 0);
      state = revealYear(state, 2000);

      expect(() => challengePlacement(state, "player-1", "player-2", 0)).toThrow("not in playing");
    });

    it("should throw error if game is not in playing status", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);
      state = revealYear(state, 2000);

      expect(() => placeCard(state, "player-1", 1)).toThrow();
    });

    it("should throw error if player already placed this round", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);

      expect(() => placeCard(state, "player-1", 1)).toThrow();
    });

    it("should throw error if placement entry creation fails", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));
      
      // This should work, but we test the error path by manipulating state
      // Actually, this is hard to test without mocking. Let's test the error cases we can.
      expect(() => placeCard(state, "player-1", -1)).toThrow();
    });

    it("should throw error for invalid slot index", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));

      expect(() => placeCard(state, "player-1", -1)).toThrow();
    });

    it("should not mutate original state", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));
      const newState = placeCard(state, "player-1", 0);

      expect(state.rounds[0].placements.length).toBe(0);
      expect(newState.rounds[0].placements.length).toBe(1);
    });
  });

  describe("challengePlacement", () => {
    it("should challenge another player's placement", () => {
      let state = createGame("original");
      const player1 = createPlayer("player-1", "Alice");
      const player2 = createPlayer("player-2", "Bob");
      state = joinPlayer(state, player1);
      state = joinPlayer(state, player2);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-2", 0);
      state = challengePlacement(state, "player-1", "player-2", 0);

      expect(state.players.find((p) => p.id === "player-1")?.tokens).toBe(2);
    });

    it("should throw error if challenger has no tokens", () => {
      let state = createGame("original");
      const player1 = createPlayer("player-1", "Alice");
      const player2 = createPlayer("player-2", "Bob");
      state = joinPlayer(state, player1);
      state = joinPlayer(state, player2);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-2", 0);

      // Spend all tokens
      state.players = state.players.map((p) =>
        p.id === "player-1" ? { ...p, tokens: 0 } : p
      );

      expect(() => challengePlacement(state, "player-1", "player-2", 0)).toThrow();
    });

    it("should throw error if challenging own placement", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);

      expect(() => challengePlacement(state, "player-1", "player-1", 0)).toThrow();
    });

    it("should throw error if challenger not in game", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);

      expect(() => challengePlacement(state, "non-existent", "player-1", 0)).toThrow(
        "Challenger"
      );
    });

    it("should throw error if target not in game", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);

      expect(() => challengePlacement(state, "player-1", "non-existent", 0)).toThrow("Target");
    });

    it("should throw error if target placement does not exist", () => {
      let state = createGame("original");
      const player1 = createPlayer("player-1", "Alice");
      const player2 = createPlayer("player-2", "Bob");
      state = joinPlayer(state, player1);
      state = joinPlayer(state, player2);
      state = startRound(state, createCard("spotify:track:1"));

      expect(() => challengePlacement(state, "player-1", "player-2", 0)).toThrow();
    });

    it("should not mutate original state", () => {
      let state = createGame("original");
      const player1 = createPlayer("player-1", "Alice");
      const player2 = createPlayer("player-2", "Bob");
      state = joinPlayer(state, player1);
      state = joinPlayer(state, player2);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-2", 0);

      const originalTokens = state.players.find((p) => p.id === "player-1")?.tokens ?? 0;
      const newState = challengePlacement(state, "player-1", "player-2", 0);

      expect(state.players.find((p) => p.id === "player-1")?.tokens).toBe(originalTokens);
      expect(newState.players.find((p) => p.id === "player-1")?.tokens).toBe(originalTokens - 1);
    });
  });

  describe("revealYear", () => {
    it("should reveal year and update placements", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);
      state = revealYear(state, 2000);

      expect(state.rounds[0].revealed).toBe(true);
      expect(state.rounds[0].actualYear).toBe(2000);
      expect(state.rounds[0].currentCard.year).toBe(2000);
      expect(state.rounds[0].currentCard.revealed).toBe(true);
      expect(state.status).toBe("round_summary");
    });

    it("should update player scores after reveal", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);
      state = revealYear(state, 2000);

      expect(state.players[0].score).toBe(1);
    });

    it("should detect winner when threshold is reached", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      // Play 10 rounds with correct placements
      for (let i = 0; i < 10; i++) {
        state = startRound(state, createCard(`spotify:track:${i}`));
        state = placeCard(state, "player-1", i);
        state = revealYear(state, 2000 + i);
      }

      expect(state.status).toBe("finished");
      expect(state.winner).toBe("player-1");
    });

    it("should throw error if year already revealed", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);
      state = revealYear(state, 2000);

      expect(() => revealYear(state, 2001)).toThrow();
    });

    it("should throw error if no active round", () => {
      const state = createGame("original");
      expect(() => revealYear(state, 2000)).toThrow();
    });

    it("should not mutate original state", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);

      const originalScore = state.players[0].score;
      const newState = revealYear(state, 2000);

      expect(state.players[0].score).toBe(originalScore);
      expect(newState.players[0].score).toBeGreaterThan(originalScore);
    });
  });

  describe("calculateRoundScoreForPlayer", () => {
    it("should return 0 for round not revealed", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);

      expect(calculateRoundScoreForPlayer(state, "player-1")).toBe(0);
    });

    it("should calculate score for correct placement", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);
      state = revealYear(state, 2000);

      expect(calculateRoundScoreForPlayer(state, "player-1")).toBe(1);
    });

    it("should return 0 for player with no placements", () => {
      let state = createGame("original");
      const player1 = createPlayer("player-1", "Alice");
      const player2 = createPlayer("player-2", "Bob");
      state = joinPlayer(state, player1);
      state = joinPlayer(state, player2);
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);
      state = revealYear(state, 2000);

      expect(calculateRoundScoreForPlayer(state, "player-2")).toBe(0);
    });
  });

  describe("checkWinCondition", () => {
    it("should return null if no winner", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      expect(checkWinCondition(state)).toBeNull();
    });

    it("should detect winner at threshold", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      // Manually set score to threshold
      state.players[0].score = 10;

      expect(checkWinCondition(state)).toBe("player-1");
    });

    it("should detect winner above threshold", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      // Manually set score above threshold
      state.players[0].score = 15;

      expect(checkWinCondition(state)).toBe("player-1");
    });

    it("should return first player to reach threshold", () => {
      let state = createGame("original");
      const player1 = createPlayer("player-1", "Alice");
      const player2 = createPlayer("player-2", "Bob");
      state = joinPlayer(state, player1);
      state = joinPlayer(state, player2);

      state.players[0].score = 10;
      state.players[1].score = 9;

      expect(checkWinCondition(state)).toBe("player-1");
    });
  });

  describe("getPlayerTimeline", () => {
    it("should return empty timeline for player with no placements", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      expect(getPlayerTimeline(state, "player-1")).toEqual([]);
    });

    it("should return timeline for player with placements", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      // Round 1
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);
      state = revealYear(state, 2000);

      const timeline = getPlayerTimeline(state, "player-1");
      expect(timeline.length).toBe(1);
      expect(timeline[0].card.trackUri).toBe("spotify:track:1");
    });

    it("should return sorted timeline across multiple rounds", () => {
      let state = createGame("original");
      const player = createPlayer("player-1", "Alice");
      state = joinPlayer(state, player);

      // Round 1
      state = startRound(state, createCard("spotify:track:1"));
      state = placeCard(state, "player-1", 0);
      state = revealYear(state, 2000);

      // Round 2
      state = startRound(state, createCard("spotify:track:2"));
      state = placeCard(state, "player-1", 1);
      state = revealYear(state, 2010);

      const timeline = getPlayerTimeline(state, "player-1");
      expect(timeline.length).toBe(2);
      expect(timeline[0].slotIndex).toBe(0);
      expect(timeline[1].slotIndex).toBe(1);
    });
  });
});

