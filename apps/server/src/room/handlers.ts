import type { WebSocket } from "ws";
import { createMessage, type CreateRoom, type JoinRoom, type Leave } from "@hitster/proto";
import { joinPlayer, removePlayer, type GameMode } from "@hitster/engine";
import { roomManager } from "./room-manager.js";
import { RoomModel, PlayerModel, type Room, type Player } from "../db/models.js";
import { connectionManager } from "../connection.js";
import { logger } from "../logger.js";
import { gameStateManager } from "../game/game-state-manager.js";

/**
 * Database and models (will be initialized by server).
 */
let roomModel: RoomModel;
let playerModel: PlayerModel;

/**
 * Initialize handlers with database models.
 */
export function initializeHandlers(rm: RoomModel, pm: PlayerModel): void {
  roomModel = rm;
  playerModel = pm;
}

/**
 * Handle CREATE_ROOM message.
 */
export async function handleCreateRoom(
  connectionId: string,
  socket: WebSocket,
  payload: CreateRoom
): Promise<void> {
  try {
    const { gameMode } = payload;

    // Create room in database
    const room = roomModel.createRoom(gameMode);

    // Initialize game state
    gameStateManager.initializeGameState(room.id, gameMode as GameMode);

    // Associate connection with room
    roomManager.associateConnection(connectionId, room.id);

    // Update connection metadata
    const metadata = connectionManager.getConnection(connectionId);
    if (metadata) {
      metadata.roomId = room.id;
      metadata.roomKey = room.roomKey;
    }

    // Send ROOM_CREATED response
    const response = createMessage("ROOM_CREATED", {
      roomKey: room.roomKey,
      roomId: room.id,
    });

    roomManager.sendToConnection(connectionId, response);

    logger.info(
      {
        connectionId,
        roomId: room.id,
        roomKey: room.roomKey,
        gameMode,
      },
      "Room created"
    );
  } catch (error) {
    logger.error(
      {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to create room"
    );
    roomManager.sendError(connectionId, "CREATE_ROOM_FAILED", "Failed to create room");
  }
}

/**
 * Handle JOIN_ROOM message.
 */
export async function handleJoinRoom(
  connectionId: string,
  socket: WebSocket,
  payload: JoinRoom
): Promise<void> {
  try {
    const { roomKey, name, avatar } = payload;

    // Validate room exists
    const room = roomModel.getRoomByKey(roomKey);
    if (!room) {
      roomManager.sendError(connectionId, "ROOM_NOT_FOUND", "Room not found");
      return;
    }

    // Check if connection already has a player in this room
    const existingPlayerBySocket = playerModel.getPlayerBySocketId(connectionId);
    if (existingPlayerBySocket && existingPlayerBySocket.roomId === room.id) {
      // Player already exists in this room with this socket - just send updated state
      const players = playerModel.getRoomPlayers(room.id);
      const currentGameState = gameStateManager.getGameState(room.id);
      
      // Send JOINED response to the existing player
      const joinedResponse = createMessage("JOINED", {
        playerId: existingPlayerBySocket.id,
        roomKey: room.roomKey,
        players: players.map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
        })),
      });
      
      roomManager.sendToConnection(connectionId, joinedResponse);
      
      // Broadcast updated ROOM_STATE to all players in room
      const roomStateResponse = createMessage("ROOM_STATE", {
        roomKey: room.roomKey,
        players: players.map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
        })),
        gameState: currentGameState
          ? {
              status: currentGameState.status,
              currentRound: currentGameState.currentRound,
              currentTrack:
                currentGameState.rounds[currentGameState.currentRound]?.currentCard.trackUri,
            }
          : undefined,
      });
      
      roomManager.broadcastToRoom(room.id, roomStateResponse);
      
      logger.info(
        {
          connectionId,
          playerId: existingPlayerBySocket.id,
          roomId: room.id,
          roomKey: room.roomKey,
        },
        "Player already in room, re-sent state"
      );
      return;
    }

    // Check if there's already a player in this room with the same name and avatar
    // This handles reconnections after redirects (e.g., Spotify callback)
    const allRoomPlayers = playerModel.getRoomPlayers(room.id);
    const existingPlayerByName = allRoomPlayers.find(
      (p) => p.name === name && p.avatar === avatar
    );

    if (existingPlayerByName) {
      // Player with same name/avatar already exists - update their socket_id
      // This handles reconnections where the connectionId changed
      // First, check if the new socket_id is already in use by another player
      const playerWithNewSocket = playerModel.getPlayerBySocketId(connectionId);
      if (playerWithNewSocket && playerWithNewSocket.id !== existingPlayerByName.id) {
        // Another player is using this socket_id - remove them first
        logger.warn(
          {
            connectionId,
            existingPlayerId: existingPlayerByName.id,
            conflictingPlayerId: playerWithNewSocket.id,
          },
          "New socket_id already in use, removing conflicting player"
        );
        // Remove the conflicting player from game state and database
        const conflictingRoomId = playerWithNewSocket.roomId;
        const conflictingGameState = gameStateManager.getGameState(conflictingRoomId);
        if (conflictingGameState) {
          try {
            const updatedState = removePlayer(conflictingGameState, playerWithNewSocket.id);
            gameStateManager.setGameState(conflictingRoomId, updatedState);
            gameStateManager.persistGameState(conflictingRoomId, updatedState);
          } catch (error) {
            logger.warn(
              {
                roomId: conflictingRoomId,
                playerId: playerWithNewSocket.id,
                error: error instanceof Error ? error.message : String(error),
              },
              "Failed to remove conflicting player from game state"
            );
          }
        }
        playerModel.removePlayer(connectionId);
      }
      
      // Now update the existing player's socket_id
      playerModel.updatePlayerSocketId(existingPlayerByName.id, connectionId);
      
      // Update connection metadata
      const metadata = connectionManager.getConnection(connectionId);
      if (metadata) {
        metadata.roomId = room.id;
        metadata.playerId = existingPlayerByName.id;
        metadata.roomKey = room.roomKey;
      }
      
      // Associate connection with room
      roomManager.associateConnection(connectionId, room.id);
      
      // Get updated players list
      const players = playerModel.getRoomPlayers(room.id);
      const currentGameState = gameStateManager.getGameState(room.id);
      
      // Send JOINED response
      const joinedResponse = createMessage("JOINED", {
        playerId: existingPlayerByName.id,
        roomKey: room.roomKey,
        players: players.map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
        })),
      });
      
      roomManager.sendToConnection(connectionId, joinedResponse);
      
      // Broadcast updated ROOM_STATE
      const roomStateResponse = createMessage("ROOM_STATE", {
        roomKey: room.roomKey,
        players: players.map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
        })),
        gameState: currentGameState
          ? {
              status: currentGameState.status,
              currentRound: currentGameState.currentRound,
              currentTrack:
                currentGameState.rounds[currentGameState.currentRound]?.currentCard.trackUri,
            }
          : undefined,
      });
      
      roomManager.broadcastToRoom(room.id, roomStateResponse);
      
      logger.info(
        {
          connectionId,
          playerId: existingPlayerByName.id,
          roomId: room.id,
          roomKey: room.roomKey,
          oldSocketId: existingPlayerByName.socketId,
        },
        "Player reconnected, updated socket_id"
      );
      return;
    }

    // Check if connection is already in a different room
    const existingRoomId = roomManager.getRoomForConnection(connectionId);
    if (existingRoomId && existingRoomId !== room.id) {
      // Remove from old room first
      if (existingPlayerBySocket) {
        await handleLeave(connectionId, socket, { playerId: existingPlayerBySocket.id });
      }
    }

    // Add new player to room
    const player = playerModel.addPlayer(room.id, connectionId, name, avatar);

    // Associate connection with room
    roomManager.associateConnection(connectionId, room.id);

    // Update connection metadata
    const metadata = connectionManager.getConnection(connectionId);
    if (metadata) {
      metadata.roomId = room.id;
      metadata.playerId = player.id;
      metadata.roomKey = room.roomKey;
    }

    // Add player to game state
    const gameState = gameStateManager.getGameState(room.id);
    if (gameState) {
      try {
        const updatedState = joinPlayer(gameState, {
          id: player.id,
          name: player.name,
          avatar: player.avatar,
          tokens: 0, // Will be set by joinPlayer based on game mode
          score: 0,
        });
        gameStateManager.setGameState(room.id, updatedState);
        gameStateManager.persistGameState(room.id, updatedState);
      } catch (error) {
        logger.warn(
          {
            roomId: room.id,
            playerId: player.id,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to add player to game state (may already be in game)"
        );
      }
    }

    // Get all players in room
    const players = playerModel.getRoomPlayers(room.id);

    // Get updated game state for broadcast
    const currentGameState = gameStateManager.getGameState(room.id);

    // Send JOINED response to the new player
    const joinedResponse = createMessage("JOINED", {
      playerId: player.id,
      roomKey: room.roomKey,
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
      })),
    });

    roomManager.sendToConnection(connectionId, joinedResponse);

    // Broadcast updated ROOM_STATE to all players in room
    const roomStateResponse = createMessage("ROOM_STATE", {
      roomKey: room.roomKey,
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
      })),
      gameState: currentGameState
        ? {
            status: currentGameState.status,
            currentRound: currentGameState.currentRound,
            currentTrack:
              currentGameState.rounds[currentGameState.currentRound]?.currentCard.trackUri,
          }
        : undefined,
    });

    roomManager.broadcastToRoom(room.id, roomStateResponse);

    logger.info(
      {
        connectionId,
        playerId: player.id,
        roomId: room.id,
        roomKey: room.roomKey,
        name,
      },
      "Player joined room"
    );
  } catch (error) {
    logger.error(
      {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to join room"
    );
    roomManager.sendError(connectionId, "JOIN_ROOM_FAILED", "Failed to join room");
  }
}

/**
 * Handle LEAVE message.
 */
export async function handleLeave(
  connectionId: string,
  socket: WebSocket,
  payload: Leave
): Promise<void> {
  try {
    // Get player info before removal
    const player = playerModel.getPlayerBySocketId(connectionId);
    if (!player) {
      logger.warn({ connectionId }, "Player not found when leaving");
      return;
    }

    const roomId = player.roomId;

    // Remove player from game state
    const gameState = gameStateManager.getGameState(roomId);
    if (gameState) {
      try {
        const updatedState = removePlayer(gameState, player.id);
        gameStateManager.setGameState(roomId, updatedState);
        gameStateManager.persistGameState(roomId, updatedState);
      } catch (error) {
        logger.warn(
          {
            roomId,
            playerId: player.id,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to remove player from game state"
        );
      }
    }

    // Remove player from database
    playerModel.removePlayer(connectionId);

    // Disassociate connection from room
    roomManager.disassociateConnection(connectionId);

    // Get remaining players
    const remainingPlayers = playerModel.getRoomPlayers(roomId);

    // Get room info
    const room = roomModel.getRoomById(roomId);
    if (!room) {
      logger.warn({ roomId }, "Room not found when player left");
      return;
    }

    // Get updated game state for broadcast
    const currentGameState = gameStateManager.getGameState(roomId);

    // Broadcast updated ROOM_STATE to remaining players
    const roomStateResponse = createMessage("ROOM_STATE", {
      roomKey: room.roomKey,
      players: remainingPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
      })),
      gameState: currentGameState
        ? {
            status: currentGameState.status,
            currentRound: currentGameState.currentRound,
            currentTrack:
              currentGameState.rounds[currentGameState.currentRound]?.currentCard.trackUri,
          }
        : undefined,
    });

    roomManager.broadcastToRoom(roomId, roomStateResponse);

    logger.info(
      {
        connectionId,
        playerId: player.id,
        roomId,
        remainingPlayers: remainingPlayers.length,
      },
      "Player left room"
    );
  } catch (error) {
    logger.error(
      {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Error handling player leave"
    );
  }
}

