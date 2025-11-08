import type Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../logger.js";

export interface Room {
  id: string;
  roomKey: string;
  gameMode: string;
  createdAt: number;
  gameState: string | null;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  roomId: string;
  socketId: string;
  createdAt: number;
}

/**
 * Room database operations.
 */
export class RoomModel {
  constructor(private db: Database.Database) {}

  /**
   * Generate a unique 6-digit room key.
   */
  generateRoomKey(): string {
    const maxAttempts = 100;
    for (let i = 0; i < maxAttempts; i++) {
      const key = Math.floor(100000 + Math.random() * 900000).toString();
      if (!this.getRoomByKey(key)) {
        return key;
      }
    }
    throw new Error("Failed to generate unique room key after maximum attempts");
  }

  /**
   * Create a new room.
   */
  createRoom(gameMode: string): Room {
    const id = uuidv4();
    const roomKey = this.generateRoomKey();
    const createdAt = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO rooms (id, room_key, game_mode, created_at, game_state)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, roomKey, gameMode, createdAt, null);

    const room: Room = {
      id,
      roomKey,
      gameMode,
      createdAt,
      gameState: null,
    };

    logger.debug({ roomId: id, roomKey }, "Room created");
    return room;
  }

  /**
   * Get a room by its key.
   */
  getRoomByKey(roomKey: string): Room | null {
    const stmt = this.db.prepare(`
      SELECT id, room_key, game_mode, created_at, game_state
      FROM rooms
      WHERE room_key = ?
    `);

    const row = stmt.get(roomKey) as
      | {
          id: string;
          room_key: string;
          game_mode: string;
          created_at: number;
          game_state: string | null;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      roomKey: row.room_key,
      gameMode: row.game_mode,
      createdAt: row.created_at,
      gameState: row.game_state,
    };
  }

  /**
   * Get a room by its ID.
   */
  getRoomById(roomId: string): Room | null {
    const stmt = this.db.prepare(`
      SELECT id, room_key, game_mode, created_at, game_state
      FROM rooms
      WHERE id = ?
    `);

    const row = stmt.get(roomId) as
      | {
          id: string;
          room_key: string;
          game_mode: string;
          created_at: number;
          game_state: string | null;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      roomKey: row.room_key,
      gameMode: row.game_mode,
      createdAt: row.created_at,
      gameState: row.game_state,
    };
  }

  /**
   * Update game state for a room.
   */
  updateGameState(roomId: string, gameState: string | null): void {
    const stmt = this.db.prepare(`
      UPDATE rooms
      SET game_state = ?
      WHERE id = ?
    `);

    stmt.run(gameState, roomId);
  }

  /**
   * Delete a room and all its players (cascade).
   */
  deleteRoom(roomId: string): void {
    const stmt = this.db.prepare(`DELETE FROM rooms WHERE id = ?`);
    stmt.run(roomId);
    logger.debug({ roomId }, "Room deleted");
  }

  /**
   * Get all rooms.
   */
  getAllRooms(): Room[] {
    const stmt = this.db.prepare(`
      SELECT id, room_key, game_mode, created_at, game_state
      FROM rooms
    `);

    const rows = stmt.all() as Array<{
      id: string;
      room_key: string;
      game_mode: string;
      created_at: number;
      game_state: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      roomKey: row.room_key,
      gameMode: row.game_mode,
      createdAt: row.created_at,
      gameState: row.game_state,
    }));
  }

  /**
   * Get count of active rooms.
   */
  getRoomCount(): number {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM rooms`);
    const row = stmt.get() as { count: number };
    return row.count;
  }
}

/**
 * Player database operations.
 */
export class PlayerModel {
  constructor(private db: Database.Database) {}

  /**
   * Add a player to a room.
   */
  addPlayer(roomId: string, socketId: string, name: string, avatar: string): Player {
    const id = uuidv4();
    const createdAt = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO players (id, name, avatar, room_id, socket_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, name, avatar, roomId, socketId, createdAt);

    const player: Player = {
      id,
      name,
      avatar,
      roomId,
      socketId,
      createdAt,
    };

    logger.debug({ playerId: id, roomId, socketId }, "Player added to room");
    return player;
  }

  /**
   * Remove a player by socket ID.
   */
  removePlayer(socketId: string): Player | null {
    const player = this.getPlayerBySocketId(socketId);
    if (!player) {
      return null;
    }

    const stmt = this.db.prepare(`DELETE FROM players WHERE socket_id = ?`);
    stmt.run(socketId);

    logger.debug({ playerId: player.id, socketId }, "Player removed from room");
    return player;
  }

  /**
   * Get a player by socket ID.
   */
  getPlayerBySocketId(socketId: string): Player | null {
    const stmt = this.db.prepare(`
      SELECT id, name, avatar, room_id, socket_id, created_at
      FROM players
      WHERE socket_id = ?
    `);

    const row = stmt.get(socketId) as
      | {
          id: string;
          name: string;
          avatar: string;
          room_id: string;
          socket_id: string;
          created_at: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      roomId: row.room_id,
      socketId: row.socket_id,
      createdAt: row.created_at,
    };
  }

  /**
   * Update a player's socket ID (for reconnections).
   */
  updatePlayerSocketId(playerId: string, newSocketId: string): void {
    const stmt = this.db.prepare(`
      UPDATE players
      SET socket_id = ?
      WHERE id = ?
    `);
    
    stmt.run(newSocketId, playerId);
    
    logger.debug({ playerId, newSocketId }, "Updated player socket_id");
  }

  /**
   * Get all players in a room.
   */
  getRoomPlayers(roomId: string): Player[] {
    const stmt = this.db.prepare(`
      SELECT id, name, avatar, room_id, socket_id, created_at
      FROM players
      WHERE room_id = ?
      ORDER BY created_at ASC
    `);

    const rows = stmt.all(roomId) as Array<{
      id: string;
      name: string;
      avatar: string;
      room_id: string;
      socket_id: string;
      created_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      roomId: row.room_id,
      socketId: row.socket_id,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get player count for a room.
   */
  getPlayerCount(roomId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM players
      WHERE room_id = ?
    `);

    const row = stmt.get(roomId) as { count: number };
    return row.count;
  }

  /**
   * Check if a room has any players.
   */
  hasPlayers(roomId: string): boolean {
    return this.getPlayerCount(roomId) > 0;
  }
}

