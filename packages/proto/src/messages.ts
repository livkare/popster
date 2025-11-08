import { z } from "zod";

// ============================================================================
// Core Game Messages
// ============================================================================

export const JoinSchema = z.object({
  name: z.string().min(1).max(50),
  avatar: z.string().min(1).max(100),
});

export const SeatSchema = z.object({
  playerId: z.string().uuid(),
});

export const StartSongSchema = z.object({
  trackUri: z.string().min(1),
  positionMs: z.number().int().nonnegative().optional(),
});

export const PlaceSchema = z.object({
  playerId: z.string().uuid(),
  slotIndex: z.number().int().nonnegative(),
});

export const ChallengeSchema = z.object({
  playerId: z.string().uuid(),
  targetPlayerId: z.string().uuid(),
  slotIndex: z.number().int().nonnegative(),
});

export const RevealSchema = z.object({
  year: z.number().int().min(1900).max(2100),
});

export const StartRoundSchema = z.object({
  trackUri: z.string().min(1),
});

export const RoundSummarySchema = z.object({
  timeline: z.array(
    z.object({
      year: z.number().int().min(1900).max(2100),
      trackUri: z.string().optional(),
      playerId: z.string().uuid().optional(),
    })
  ),
  scores: z.record(z.string().uuid(), z.number().int()),
});

// ============================================================================
// Room Management Messages
// ============================================================================

export const CreateRoomSchema = z.object({
  gameMode: z.string().min(1),
});

export const RoomCreatedSchema = z.object({
  roomKey: z.string().length(6),
  roomId: z.string().uuid(),
});

export const JoinRoomSchema = z.object({
  roomKey: z.string().length(6),
  name: z.string().min(1).max(50),
  avatar: z.string().min(1).max(100),
});

export const JoinedSchema = z.object({
  playerId: z.string().uuid(),
  roomKey: z.string().length(6),
  players: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      avatar: z.string(),
    })
  ),
});

export const LeaveSchema = z.object({
  playerId: z.string().uuid(),
});

export const RoomStateSchema = z.object({
  players: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      avatar: z.string(),
    })
  ),
  gameState: z
    .object({
      status: z.enum(["lobby", "playing", "round_summary", "finished"]),
      currentRound: z.number().int().nonnegative().optional(),
      currentTrack: z.string().optional(),
    })
    .optional(),
  roomKey: z.string().length(6),
});

export const ErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export const PongSchema = z.object({}).strict();

// ============================================================================
// Spotify Device Messages
// ============================================================================

export const RegisterDeviceSchema = z.object({
  deviceId: z.string().min(1),
});

export const DeviceRegisteredSchema = z.object({
  deviceId: z.string().min(1),
  success: z.boolean(),
});

export const RequestRoomStateSchema = z.object({
  roomKey: z.string().length(6),
});

// ============================================================================
// Message Envelope - Discriminated Union
// ============================================================================

export const MessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("JOIN"), payload: JoinSchema }),
  z.object({ type: z.literal("SEAT"), payload: SeatSchema }),
  z.object({ type: z.literal("START_SONG"), payload: StartSongSchema }),
  z.object({ type: z.literal("PLACE"), payload: PlaceSchema }),
  z.object({ type: z.literal("CHALLENGE"), payload: ChallengeSchema }),
  z.object({ type: z.literal("REVEAL"), payload: RevealSchema }),
  z.object({ type: z.literal("START_ROUND"), payload: StartRoundSchema }),
  z.object({ type: z.literal("ROUND_SUMMARY"), payload: RoundSummarySchema }),
  z.object({ type: z.literal("CREATE_ROOM"), payload: CreateRoomSchema }),
  z.object({ type: z.literal("ROOM_CREATED"), payload: RoomCreatedSchema }),
  z.object({ type: z.literal("JOIN_ROOM"), payload: JoinRoomSchema }),
  z.object({ type: z.literal("JOINED"), payload: JoinedSchema }),
  z.object({ type: z.literal("LEAVE"), payload: LeaveSchema }),
  z.object({ type: z.literal("ROOM_STATE"), payload: RoomStateSchema }),
  z.object({ type: z.literal("ERROR"), payload: ErrorSchema }),
  z.object({ type: z.literal("PONG"), payload: PongSchema }),
  z.object({ type: z.literal("REGISTER_DEVICE"), payload: RegisterDeviceSchema }),
  z.object({ type: z.literal("DEVICE_REGISTERED"), payload: DeviceRegisteredSchema }),
  z.object({ type: z.literal("REQUEST_ROOM_STATE"), payload: RequestRoomStateSchema }),
]);

// ============================================================================
// TypeScript Types
// ============================================================================

export type Join = z.infer<typeof JoinSchema>;
export type Seat = z.infer<typeof SeatSchema>;
export type StartSong = z.infer<typeof StartSongSchema>;
export type Place = z.infer<typeof PlaceSchema>;
export type Challenge = z.infer<typeof ChallengeSchema>;
export type Reveal = z.infer<typeof RevealSchema>;
export type StartRound = z.infer<typeof StartRoundSchema>;
export type RoundSummary = z.infer<typeof RoundSummarySchema>;
export type CreateRoom = z.infer<typeof CreateRoomSchema>;
export type RoomCreated = z.infer<typeof RoomCreatedSchema>;
export type JoinRoom = z.infer<typeof JoinRoomSchema>;
export type Joined = z.infer<typeof JoinedSchema>;
export type Leave = z.infer<typeof LeaveSchema>;
export type RoomState = z.infer<typeof RoomStateSchema>;
export type Error = z.infer<typeof ErrorSchema>;
export type Pong = z.infer<typeof PongSchema>;
export type RegisterDevice = z.infer<typeof RegisterDeviceSchema>;
export type DeviceRegistered = z.infer<typeof DeviceRegisteredSchema>;
export type RequestRoomState = z.infer<typeof RequestRoomStateSchema>;
export type Message = z.infer<typeof MessageSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

export function createMessage<T extends Message["type"]>(
  type: T,
  payload: Extract<Message, { type: T }>["payload"]
): Extract<Message, { type: T }> {
  return { type, payload } as Extract<Message, { type: T }>;
}

