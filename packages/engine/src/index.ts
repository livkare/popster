// Export all types
export type {
  GameMode,
  GameStatus,
  Card,
  Player,
  TimelineEntry,
  Round,
  GameState,
} from "./types.js";

// Export all actions
export type {
  JoinPlayerAction,
  StartRoundAction,
  PlaceCardAction,
  ChallengeAction,
  RevealYearAction,
  GameAction,
} from "./actions.js";

// Export core game functions
export {
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

// Export token functions
export {
  getTokenCount,
  spendToken,
  awardToken,
  hasTokens,
} from "./tokens.js";

// Export scoring functions
export {
  calculatePlacementScore,
  calculateChallengeScore,
  calculateRoundScore,
  updatePlayerScores,
} from "./scoring.js";

// Export timeline functions
export {
  insertCard,
  validatePlacement,
  isCorrectPlacement,
  getSortedTimeline,
} from "./timeline.js";

// Export mode functions
export {
  getStartingTokens,
  getWinThreshold,
  requiresAdditionalInput,
  isActionAllowed,
} from "./modes.js";
