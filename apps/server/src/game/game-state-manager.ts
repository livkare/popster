import type { GameMode, GameState } from "@hitster/engine";
import { createGame } from "@hitster/engine";
import type { RoomModel } from "../db/models.js";
import { logger } from "../logger.js";

/**
 * Manages game state for all rooms.
 * Maintains in-memory state for fast access and persists to SQLite.
 */
interface PlaylistTrack {
  trackUri: string;
  name: string;
  artist: string;
  releaseYear: number | null;
  albumArt?: string;
}

export class GameStateManager {
  // In-memory game state storage
  private gameStates = new Map<string, GameState>();

  // Shuffled playlist tracks for each room (remaining tracks to play)
  private playlistTracks = new Map<string, PlaylistTrack[]>();

  // Room model for persistence
  private roomModel: RoomModel | null = null;

  /**
   * Initialize the game state manager with a room model for persistence.
   */
  initialize(roomModel: RoomModel): void {
    this.roomModel = roomModel;
    logger.info("Game state manager initialized");
  }

  /**
   * Get game state for a room.
   */
  getGameState(roomId: string): GameState | null {
    // Try in-memory first
    const inMemoryState = this.gameStates.get(roomId);
    if (inMemoryState) {
      return inMemoryState;
    }

    // Try loading from database
    return this.loadGameState(roomId);
  }

  /**
   * Set game state for a room (in-memory only).
   * Use persistGameState to also save to database.
   */
  setGameState(roomId: string, state: GameState): void {
    this.gameStates.set(roomId, state);
    logger.debug({ roomId, status: state.status }, "Game state updated in memory");
  }

  /**
   * Initialize a new game state for a room.
   */
  initializeGameState(roomId: string, mode: GameMode): GameState {
    const gameState = createGame(mode);
    this.setGameState(roomId, gameState);
    this.persistGameState(roomId, gameState);
    logger.info({ roomId, mode }, "Game state initialized");
    return gameState;
  }

  /**
   * Persist game state to SQLite database.
   */
  persistGameState(roomId: string, state: GameState): void {
    if (!this.roomModel) {
      logger.warn("Room model not initialized, cannot persist game state");
      return;
    }

    try {
      const gameStateJson = JSON.stringify(state);
      this.roomModel.updateGameState(roomId, gameStateJson);
      logger.debug({ roomId }, "Game state persisted to database");
    } catch (error) {
      logger.error(
        {
          roomId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to persist game state"
      );
    }
  }

  /**
   * Load game state from SQLite database.
   */
  loadGameState(roomId: string): GameState | null {
    if (!this.roomModel) {
      logger.warn("Room model not initialized, cannot load game state");
      return null;
    }

    try {
      const room = this.roomModel.getRoomById(roomId);
      if (!room || !room.gameState) {
        return null;
      }

      const gameState = JSON.parse(room.gameState) as GameState;
      // Cache in memory
      this.gameStates.set(roomId, gameState);
      logger.debug({ roomId }, "Game state loaded from database");
      return gameState;
    } catch (error) {
      logger.error(
        {
          roomId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to load game state"
      );
      return null;
    }
  }

  /**
   * Remove game state for a room (when room is deleted).
   */
  removeGameState(roomId: string): void {
    this.gameStates.delete(roomId);
    this.playlistTracks.delete(roomId);
    logger.debug({ roomId }, "Game state removed from memory");
  }

  /**
   * Initialize playlist tracks for a room (shuffled).
   * Should be called when game starts.
   */
  initializePlaylistTracks(roomId: string, tracks: PlaylistTrack[]): void {
    // Filter tracks with release year and shuffle
    const tracksWithYear = tracks.filter((t) => t.releaseYear !== null);
    const shuffled = this.shuffleTracks([...tracksWithYear]);
    this.playlistTracks.set(roomId, shuffled);
    logger.info({ roomId, trackCount: shuffled.length }, "Playlist tracks initialized and shuffled");
  }

  /**
   * Get next track from playlist for a room.
   * Returns null if no tracks remaining.
   */
  getNextTrack(roomId: string): PlaylistTrack | null {
    const tracks = this.playlistTracks.get(roomId);
    if (!tracks || tracks.length === 0) {
      return null;
    }
    return tracks[0];
  }

  /**
   * Remove the current track from remaining tracks (after it's been used).
   */
  consumeTrack(roomId: string): void {
    const tracks = this.playlistTracks.get(roomId);
    if (tracks && tracks.length > 0) {
      tracks.shift(); // Remove first track
      logger.debug({ roomId, remaining: tracks.length }, "Track consumed from playlist");
    }
  }

  /**
   * Get remaining track count for a room.
   */
  getRemainingTrackCount(roomId: string): number {
    const tracks = this.playlistTracks.get(roomId);
    return tracks?.length || 0;
  }

  /**
   * Fisher-Yates shuffle algorithm for randomizing tracks.
   */
  private shuffleTracks<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Load all game states from database (for warm-up on server start).
   */
  loadAllGameStates(): void {
    if (!this.roomModel) {
      logger.warn("Room model not initialized, cannot load game states");
      return;
    }

    try {
      const rooms = this.roomModel.getAllRooms();
      let loadedCount = 0;

      for (const room of rooms) {
        if (room.gameState) {
          try {
            const gameState = JSON.parse(room.gameState) as GameState;
            this.gameStates.set(room.id, gameState);
            loadedCount++;
          } catch (error) {
            logger.warn(
              {
                roomId: room.id,
                error: error instanceof Error ? error.message : String(error),
              },
              "Failed to parse game state for room"
            );
          }
        }
      }

      logger.info({ loadedCount, totalRooms: rooms.length }, "Loaded game states from database");
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to load all game states"
      );
    }
  }
}

// Singleton instance
export const gameStateManager = new GameStateManager();

