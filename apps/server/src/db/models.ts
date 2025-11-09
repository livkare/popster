import type Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../logger.js";

export interface Room {
  id: string;
  roomKey: string;
  gameMode: string;
  createdAt: number;
  gameState: string | null;
  playlistId?: string;
  playlistData?: string;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  roomId: string;
  socketId: string;
  createdAt: number;
  connected: boolean;
  lastSeen: number;
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
      SELECT id, room_key, game_mode, created_at, game_state, playlist_id, playlist_data
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
          playlist_id: string | null;
          playlist_data: string | null;
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
      playlistId: row.playlist_id || undefined,
      playlistData: row.playlist_data || undefined,
    };
  }

  /**
   * Get a room by its ID.
   */
  getRoomById(roomId: string): Room | null {
    const stmt = this.db.prepare(`
      SELECT id, room_key, game_mode, created_at, game_state, playlist_id, playlist_data
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
          playlist_id: string | null;
          playlist_data: string | null;
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
      playlistId: row.playlist_id || undefined,
      playlistData: row.playlist_data || undefined,
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
   * Update playlist for a room.
   */
  updatePlaylist(roomId: string, playlistId: string, playlistData: string): void {
    const stmt = this.db.prepare(`
      UPDATE rooms
      SET playlist_id = ?, playlist_data = ?
      WHERE id = ?
    `);

    stmt.run(playlistId, playlistData, roomId);
    logger.debug({ roomId, playlistId }, "Playlist updated for room");
  }

  /**
   * Get playlist data for a room.
   */
  getPlaylist(roomId: string): { playlistId: string; playlistData: string } | null {
    const stmt = this.db.prepare(`
      SELECT playlist_id, playlist_data
      FROM rooms
      WHERE id = ?
    `);

    const row = stmt.get(roomId) as
      | {
          playlist_id: string | null;
          playlist_data: string | null;
        }
      | undefined;

    if (!row || !row.playlist_id || !row.playlist_data) {
      return null;
    }

    return {
      playlistId: row.playlist_id,
      playlistData: row.playlist_data,
    };
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
      SELECT id, room_key, game_mode, created_at, game_state, playlist_id, playlist_data
      FROM rooms
    `);

    const rows = stmt.all() as Array<{
      id: string;
      room_key: string;
      game_mode: string;
      created_at: number;
      game_state: string | null;
      playlist_id: string | null;
      playlist_data: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      roomKey: row.room_key,
      gameMode: row.game_mode,
      createdAt: row.created_at,
      gameState: row.game_state,
      playlistId: row.playlist_id || undefined,
      playlistData: row.playlist_data || undefined,
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
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO players (id, name, avatar, room_id, socket_id, created_at, connected, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, name, avatar, roomId, socketId, createdAt, 1, now);

    const player: Player = {
      id,
      name,
      avatar,
      roomId,
      socketId,
      createdAt,
      connected: true,
      lastSeen: now,
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
      SELECT id, name, avatar, room_id, socket_id, created_at, connected, last_seen
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
          connected: number;
          last_seen: number;
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
      connected: row.connected === 1,
      lastSeen: row.last_seen,
    };
  }

  /**
   * Update a player's socket ID (for reconnections).
   */
  updatePlayerSocketId(playerId: string, newSocketId: string): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE players
      SET socket_id = ?, connected = 1, last_seen = ?
      WHERE id = ?
    `);
    
    stmt.run(newSocketId, now, playerId);
    
    logger.debug({ playerId, newSocketId }, "Updated player socket_id and marked as connected");
  }

  /**
   * Mark a player as connected.
   */
  markPlayerConnected(playerId: string, socketId: string): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE players
      SET socket_id = ?, connected = 1, last_seen = ?
      WHERE id = ?
    `);
    
    stmt.run(socketId, now, playerId);
    
    logger.debug({ playerId, socketId }, "Marked player as connected");
  }

  /**
   * Mark a player as disconnected.
   */
  markPlayerDisconnected(playerId: string): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE players
      SET connected = 0, last_seen = ?
      WHERE id = ?
    `);
    
    stmt.run(now, playerId);
    
    logger.debug({ playerId }, "Marked player as disconnected");
  }

  /**
   * Get disconnected players in a room that have been disconnected for longer than maxAgeMs.
   */
  getDisconnectedPlayers(roomId: string, maxAgeMs: number): Player[] {
    const cutoffTime = Date.now() - maxAgeMs;
    const stmt = this.db.prepare(`
      SELECT id, name, avatar, room_id, socket_id, created_at, connected, last_seen
      FROM players
      WHERE room_id = ? AND connected = 0 AND last_seen < ?
    `);

    const rows = stmt.all(roomId, cutoffTime) as Array<{
      id: string;
      name: string;
      avatar: string;
      room_id: string;
      socket_id: string;
      created_at: number;
      connected: number;
      last_seen: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      roomId: row.room_id,
      socketId: row.socket_id,
      createdAt: row.created_at,
      connected: row.connected === 1,
      lastSeen: row.last_seen,
    }));
  }

  /**
   * Remove a player by player ID (for cleanup).
   */
  removePlayerById(playerId: string): Player | null {
    const player = this.getPlayerById(playerId);
    if (!player) {
      return null;
    }

    const stmt = this.db.prepare(`DELETE FROM players WHERE id = ?`);
    stmt.run(playerId);

    logger.debug({ playerId }, "Player removed from room");
    return player;
  }

  /**
   * Get a player by player ID.
   */
  getPlayerById(playerId: string): Player | null {
    const stmt = this.db.prepare(`
      SELECT id, name, avatar, room_id, socket_id, created_at, connected, last_seen
      FROM players
      WHERE id = ?
    `);

    const row = stmt.get(playerId) as
      | {
          id: string;
          name: string;
          avatar: string;
          room_id: string;
          socket_id: string;
          created_at: number;
          connected: number;
          last_seen: number;
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
      connected: row.connected === 1,
      lastSeen: row.last_seen,
    };
  }

  /**
   * Get all players in a room (both connected and disconnected).
   */
  getRoomPlayers(roomId: string): Player[] {
    const stmt = this.db.prepare(`
      SELECT id, name, avatar, room_id, socket_id, created_at, connected, last_seen
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
      connected: number;
      last_seen: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      roomId: row.room_id,
      socketId: row.socket_id,
      createdAt: row.created_at,
      connected: row.connected === 1,
      lastSeen: row.last_seen,
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

