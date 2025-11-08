import { describe, it, expect } from "vitest";
import {
  // Types
  type GameMode,
  type GameStatus,
  type Card,
  type Player,
  type TimelineEntry,
  type Round,
  type GameState,
  // Actions
  type JoinPlayerAction,
  type StartRoundAction,
  type PlaceCardAction,
  type ChallengeAction,
  type RevealYearAction,
  type GameAction,
  // Game functions
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
  // Token functions
  getTokenCount,
  spendToken,
  awardToken,
  hasTokens,
  // Scoring functions
  calculatePlacementScore,
  calculateChallengeScore,
  calculateRoundScore,
  updatePlayerScores,
  // Timeline functions
  insertCard,
  validatePlacement,
  isCorrectPlacement,
  getSortedTimeline,
  // Mode functions
  getStartingTokens,
  getWinThreshold,
  requiresAdditionalInput,
  isActionAllowed,
} from "./index.js";

describe("Index exports", () => {
  it("should export all types", () => {
    // Type-only test - just verify imports work
    const mode: GameMode = "original";
    const status: GameStatus = "lobby";
    expect(mode).toBe("original");
    expect(status).toBe("lobby");
  });

  it("should export all game functions", () => {
    expect(typeof createGame).toBe("function");
    expect(typeof joinPlayer).toBe("function");
    expect(typeof removePlayer).toBe("function");
    expect(typeof startRound).toBe("function");
    expect(typeof placeCard).toBe("function");
    expect(typeof challengePlacement).toBe("function");
    expect(typeof revealYear).toBe("function");
    expect(typeof calculateRoundScoreForPlayer).toBe("function");
    expect(typeof checkWinCondition).toBe("function");
    expect(typeof getPlayerTimeline).toBe("function");
  });

  it("should export all token functions", () => {
    expect(typeof getTokenCount).toBe("function");
    expect(typeof spendToken).toBe("function");
    expect(typeof awardToken).toBe("function");
    expect(typeof hasTokens).toBe("function");
  });

  it("should export all scoring functions", () => {
    expect(typeof calculatePlacementScore).toBe("function");
    expect(typeof calculateChallengeScore).toBe("function");
    expect(typeof calculateRoundScore).toBe("function");
    expect(typeof updatePlayerScores).toBe("function");
  });

  it("should export all timeline functions", () => {
    expect(typeof insertCard).toBe("function");
    expect(typeof validatePlacement).toBe("function");
    expect(typeof isCorrectPlacement).toBe("function");
    expect(typeof getSortedTimeline).toBe("function");
  });

  it("should export all mode functions", () => {
    expect(typeof getStartingTokens).toBe("function");
    expect(typeof getWinThreshold).toBe("function");
    expect(typeof requiresAdditionalInput).toBe("function");
    expect(typeof isActionAllowed).toBe("function");
  });
});

