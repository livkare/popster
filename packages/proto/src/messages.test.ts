import { describe, expect, it } from "vitest";
import {
  JoinSchema,
  SeatSchema,
  StartSongSchema,
  PlaceSchema,
  ChallengeSchema,
  RevealSchema,
  RoundSummarySchema,
  CreateRoomSchema,
  RoomCreatedSchema,
  JoinRoomSchema,
  JoinedSchema,
  LeaveSchema,
  RoomStateSchema,
  ErrorSchema,
  PongSchema,
  MessageSchema,
  createMessage,
} from "./messages.js";
import {
  parseMessage,
  validateMessage,
  isJoinMessage,
  isSeatMessage,
  isStartSongMessage,
  isPlaceMessage,
  isChallengeMessage,
  isRevealMessage,
  isRoundSummaryMessage,
  isCreateRoomMessage,
  isRoomCreatedMessage,
  isJoinRoomMessage,
  isJoinedMessage,
  isLeaveMessage,
  isRoomStateMessage,
  isErrorMessage,
  isPongMessage,
} from "./index.js";

describe("JoinSchema", () => {
  it("should validate valid join message", () => {
    const valid = { name: "Alice", avatar: "avatar1" };
    expect(JoinSchema.parse(valid)).toEqual(valid);
  });

  it("should reject missing name", () => {
    expect(() => JoinSchema.parse({ avatar: "avatar1" })).toThrow();
  });

  it("should reject missing avatar", () => {
    expect(() => JoinSchema.parse({ name: "Alice" })).toThrow();
  });

  it("should reject empty name", () => {
    expect(() => JoinSchema.parse({ name: "", avatar: "avatar1" })).toThrow();
  });

  it("should reject name longer than 50 characters", () => {
    expect(() =>
      JoinSchema.parse({ name: "a".repeat(51), avatar: "avatar1" })
    ).toThrow();
  });

  it("should reject empty avatar", () => {
    expect(() => JoinSchema.parse({ name: "Alice", avatar: "" })).toThrow();
  });

  it("should reject null/undefined", () => {
    expect(() => JoinSchema.parse(null)).toThrow();
    expect(() => JoinSchema.parse(undefined)).toThrow();
  });

  it("should reject wrong types", () => {
    expect(() => JoinSchema.parse({ name: 123, avatar: "avatar1" })).toThrow();
    expect(() => JoinSchema.parse({ name: "Alice", avatar: 123 })).toThrow();
  });
});

describe("SeatSchema", () => {
  it("should validate valid seat message", () => {
    const valid = { playerId: "123e4567-e89b-12d3-a456-426614174000" };
    expect(SeatSchema.parse(valid)).toEqual(valid);
  });

  it("should reject invalid UUID", () => {
    expect(() => SeatSchema.parse({ playerId: "not-a-uuid" })).toThrow();
  });

  it("should reject missing playerId", () => {
    expect(() => SeatSchema.parse({})).toThrow();
  });

  it("should reject null/undefined", () => {
    expect(() => SeatSchema.parse(null)).toThrow();
    expect(() => SeatSchema.parse(undefined)).toThrow();
  });
});

describe("StartSongSchema", () => {
  it("should validate valid start song message", () => {
    const valid = { trackUri: "spotify:track:abc123" };
    expect(StartSongSchema.parse(valid)).toEqual(valid);
  });

  it("should validate with optional positionMs", () => {
    const valid = { trackUri: "spotify:track:abc123", positionMs: 5000 };
    expect(StartSongSchema.parse(valid)).toEqual(valid);
  });

  it("should reject negative positionMs", () => {
    expect(() =>
      StartSongSchema.parse({ trackUri: "spotify:track:abc123", positionMs: -1 })
    ).toThrow();
  });

  it("should reject non-integer positionMs", () => {
    expect(() =>
      StartSongSchema.parse({
        trackUri: "spotify:track:abc123",
        positionMs: 1.5,
      })
    ).toThrow();
  });

  it("should reject empty trackUri", () => {
    expect(() => StartSongSchema.parse({ trackUri: "" })).toThrow();
  });

  it("should reject missing trackUri", () => {
    expect(() => StartSongSchema.parse({})).toThrow();
  });
});

describe("PlaceSchema", () => {
  it("should validate valid place message", () => {
    const valid = {
      playerId: "123e4567-e89b-12d3-a456-426614174000",
      slotIndex: 0,
    };
    expect(PlaceSchema.parse(valid)).toEqual(valid);
  });

  it("should reject negative slotIndex", () => {
    expect(() =>
      PlaceSchema.parse({
        playerId: "123e4567-e89b-12d3-a456-426614174000",
        slotIndex: -1,
      })
    ).toThrow();
  });

  it("should reject non-integer slotIndex", () => {
    expect(() =>
      PlaceSchema.parse({
        playerId: "123e4567-e89b-12d3-a456-426614174000",
        slotIndex: 1.5,
      })
    ).toThrow();
  });

  it("should reject invalid UUID", () => {
    expect(() =>
      PlaceSchema.parse({ playerId: "not-a-uuid", slotIndex: 0 })
    ).toThrow();
  });
});

describe("ChallengeSchema", () => {
  it("should validate valid challenge message", () => {
    const valid = {
      playerId: "123e4567-e89b-12d3-a456-426614174000",
      targetPlayerId: "123e4567-e89b-12d3-a456-426614174001",
      slotIndex: 2,
    };
    expect(ChallengeSchema.parse(valid)).toEqual(valid);
  });

  it("should reject invalid playerId UUID", () => {
    expect(() =>
      ChallengeSchema.parse({
        playerId: "not-a-uuid",
        targetPlayerId: "123e4567-e89b-12d3-a456-426614174001",
        slotIndex: 2,
      })
    ).toThrow();
  });

  it("should reject invalid targetPlayerId UUID", () => {
    expect(() =>
      ChallengeSchema.parse({
        playerId: "123e4567-e89b-12d3-a456-426614174000",
        targetPlayerId: "not-a-uuid",
        slotIndex: 2,
      })
    ).toThrow();
  });

  it("should reject negative slotIndex", () => {
    expect(() =>
      ChallengeSchema.parse({
        playerId: "123e4567-e89b-12d3-a456-426614174000",
        targetPlayerId: "123e4567-e89b-12d3-a456-426614174001",
        slotIndex: -1,
      })
    ).toThrow();
  });
});

describe("RevealSchema", () => {
  it("should validate valid reveal message", () => {
    const valid = { year: 1999 };
    expect(RevealSchema.parse(valid)).toEqual(valid);
  });

  it("should reject year below 1900", () => {
    expect(() => RevealSchema.parse({ year: 1899 })).toThrow();
  });

  it("should reject year above 2100", () => {
    expect(() => RevealSchema.parse({ year: 2101 })).toThrow();
  });

  it("should reject non-integer year", () => {
    expect(() => RevealSchema.parse({ year: 1999.5 })).toThrow();
  });

  it("should reject missing year", () => {
    expect(() => RevealSchema.parse({})).toThrow();
  });
});

describe("RoundSummarySchema", () => {
  it("should validate valid round summary message", () => {
    const valid = {
      timeline: [
        {
          year: 1999,
          trackUri: "spotify:track:abc123",
          playerId: "123e4567-e89b-12d3-a456-426614174000",
        },
      ],
      scores: {
        "123e4567-e89b-12d3-a456-426614174000": 10,
      },
    };
    expect(RoundSummarySchema.parse(valid)).toEqual(valid);
  });

  it("should validate with optional fields", () => {
    const valid = {
      timeline: [{ year: 1999 }],
      scores: {},
    };
    expect(RoundSummarySchema.parse(valid)).toEqual(valid);
  });

  it("should reject invalid year in timeline", () => {
    expect(() =>
      RoundSummarySchema.parse({
        timeline: [{ year: 1800 }],
        scores: {},
      })
    ).toThrow();
  });

  it("should reject invalid UUID in timeline", () => {
    expect(() =>
      RoundSummarySchema.parse({
        timeline: [
          {
            year: 1999,
            playerId: "not-a-uuid",
          },
        ],
        scores: {},
      })
    ).toThrow();
  });

  it("should reject invalid UUID in scores", () => {
    expect(() =>
      RoundSummarySchema.parse({
        timeline: [],
        scores: {
          "not-a-uuid": 10,
        },
      })
    ).toThrow();
  });

  it("should reject non-integer scores", () => {
    expect(() =>
      RoundSummarySchema.parse({
        timeline: [],
        scores: {
          "123e4567-e89b-12d3-a456-426614174000": 10.5,
        },
      })
    ).toThrow();
  });
});

describe("CreateRoomSchema", () => {
  it("should validate valid create room message", () => {
    const valid = { gameMode: "original" };
    expect(CreateRoomSchema.parse(valid)).toEqual(valid);
  });

  it("should reject empty gameMode", () => {
    expect(() => CreateRoomSchema.parse({ gameMode: "" })).toThrow();
  });

  it("should reject missing gameMode", () => {
    expect(() => CreateRoomSchema.parse({})).toThrow();
  });
});

describe("RoomCreatedSchema", () => {
  it("should validate valid room created message", () => {
    const valid = {
      roomKey: "123456",
      roomId: "123e4567-e89b-12d3-a456-426614174000",
    };
    expect(RoomCreatedSchema.parse(valid)).toEqual(valid);
  });

  it("should reject roomKey not 6 characters", () => {
    expect(() =>
      RoomCreatedSchema.parse({
        roomKey: "12345",
        roomId: "123e4567-e89b-12d3-a456-426614174000",
      })
    ).toThrow();
    expect(() =>
      RoomCreatedSchema.parse({
        roomKey: "1234567",
        roomId: "123e4567-e89b-12d3-a456-426614174000",
      })
    ).toThrow();
  });

  it("should reject invalid roomId UUID", () => {
    expect(() =>
      RoomCreatedSchema.parse({ roomKey: "123456", roomId: "not-a-uuid" })
    ).toThrow();
  });
});

describe("JoinRoomSchema", () => {
  it("should validate valid join room message", () => {
    const valid = {
      roomKey: "123456",
      name: "Alice",
      avatar: "avatar1",
    };
    expect(JoinRoomSchema.parse(valid)).toEqual(valid);
  });

  it("should reject invalid roomKey length", () => {
    expect(() =>
      JoinRoomSchema.parse({ roomKey: "12345", name: "Alice", avatar: "avatar1" })
    ).toThrow();
  });

  it("should reject empty name", () => {
    expect(() =>
      JoinRoomSchema.parse({ roomKey: "123456", name: "", avatar: "avatar1" })
    ).toThrow();
  });

  it("should reject empty avatar", () => {
    expect(() =>
      JoinRoomSchema.parse({ roomKey: "123456", name: "Alice", avatar: "" })
    ).toThrow();
  });
});

describe("JoinedSchema", () => {
  it("should validate valid joined message", () => {
    const valid = {
      playerId: "123e4567-e89b-12d3-a456-426614174000",
      roomKey: "123456",
      players: [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          name: "Alice",
          avatar: "avatar1",
        },
      ],
    };
    expect(JoinedSchema.parse(valid)).toEqual(valid);
  });

  it("should reject invalid playerId UUID", () => {
    expect(() =>
      JoinedSchema.parse({
        playerId: "not-a-uuid",
        roomKey: "123456",
        players: [],
      })
    ).toThrow();
  });

  it("should reject invalid player UUID in array", () => {
    expect(() =>
      JoinedSchema.parse({
        playerId: "123e4567-e89b-12d3-a456-426614174000",
        roomKey: "123456",
        players: [
          {
            id: "not-a-uuid",
            name: "Alice",
            avatar: "avatar1",
          },
        ],
      })
    ).toThrow();
  });

  it("should reject invalid roomKey length", () => {
    expect(() =>
      JoinedSchema.parse({
        playerId: "123e4567-e89b-12d3-a456-426614174000",
        roomKey: "12345",
        players: [],
      })
    ).toThrow();
  });
});

describe("LeaveSchema", () => {
  it("should validate valid leave message", () => {
    const valid = { playerId: "123e4567-e89b-12d3-a456-426614174000" };
    expect(LeaveSchema.parse(valid)).toEqual(valid);
  });

  it("should reject invalid UUID", () => {
    expect(() => LeaveSchema.parse({ playerId: "not-a-uuid" })).toThrow();
  });
});

describe("RoomStateSchema", () => {
  it("should validate valid room state message", () => {
    const valid = {
      players: [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          name: "Alice",
          avatar: "avatar1",
        },
      ],
      gameState: {
        status: "lobby",
        currentRound: 0,
        currentTrack: "spotify:track:abc123",
      },
      roomKey: "123456",
    };
    expect(RoomStateSchema.parse(valid)).toEqual(valid);
  });

  it("should validate with optional gameState", () => {
    const valid = {
      players: [],
      roomKey: "123456",
    };
    expect(RoomStateSchema.parse(valid)).toEqual(valid);
  });

  it("should validate all gameState statuses", () => {
    const statuses = ["lobby", "playing", "round_summary", "finished"] as const;
    for (const status of statuses) {
      const valid = {
        players: [],
        gameState: { status },
        roomKey: "123456",
      };
      expect(RoomStateSchema.parse(valid)).toEqual(valid);
    }
  });

  it("should reject invalid status", () => {
    expect(() =>
      RoomStateSchema.parse({
        players: [],
        gameState: { status: "invalid" },
        roomKey: "123456",
      })
    ).toThrow();
  });

  it("should reject negative currentRound", () => {
    expect(() =>
      RoomStateSchema.parse({
        players: [],
        gameState: { status: "playing", currentRound: -1 },
        roomKey: "123456",
      })
    ).toThrow();
  });

  it("should reject invalid roomKey length", () => {
    expect(() =>
      RoomStateSchema.parse({
        players: [],
        roomKey: "12345",
      })
    ).toThrow();
  });
});

describe("ErrorSchema", () => {
  it("should validate valid error message", () => {
    const valid = { code: "ROOM_NOT_FOUND", message: "Room does not exist" };
    expect(ErrorSchema.parse(valid)).toEqual(valid);
  });

  it("should reject empty code", () => {
    expect(() => ErrorSchema.parse({ code: "", message: "Error" })).toThrow();
  });

  it("should reject empty message", () => {
    expect(() =>
      ErrorSchema.parse({ code: "ERROR", message: "" })
    ).toThrow();
  });

  it("should reject missing fields", () => {
    expect(() => ErrorSchema.parse({ code: "ERROR" })).toThrow();
    expect(() => ErrorSchema.parse({ message: "Error" })).toThrow();
  });
});

describe("PongSchema", () => {
  it("should validate valid pong message", () => {
    const valid = {};
    expect(PongSchema.parse(valid)).toEqual(valid);
  });

  it("should reject extra fields", () => {
    expect(() => PongSchema.parse({ extra: "field" })).toThrow();
  });
});

describe("MessageSchema (Envelope)", () => {
  it("should validate valid JOIN message", () => {
    const valid = {
      type: "JOIN",
      payload: { name: "Alice", avatar: "avatar1" },
    };
    expect(MessageSchema.parse(valid)).toEqual(valid);
  });

  it("should validate valid START_SONG message", () => {
    const valid = {
      type: "START_SONG",
      payload: { trackUri: "spotify:track:abc123", positionMs: 5000 },
    };
    expect(MessageSchema.parse(valid)).toEqual(valid);
  });

  it("should validate valid ERROR message", () => {
    const valid = {
      type: "ERROR",
      payload: { code: "ERROR", message: "Something went wrong" },
    };
    expect(MessageSchema.parse(valid)).toEqual(valid);
  });

  it("should reject invalid type", () => {
    expect(() =>
      MessageSchema.parse({
        type: "INVALID_TYPE",
        payload: {},
      })
    ).toThrow();
  });

  it("should reject missing type", () => {
    expect(() =>
      MessageSchema.parse({
        payload: { name: "Alice", avatar: "avatar1" },
      })
    ).toThrow();
  });

  it("should reject missing payload", () => {
    expect(() => MessageSchema.parse({ type: "JOIN" })).toThrow();
  });

  it("should reject payload that doesn't match type", () => {
    expect(() =>
      MessageSchema.parse({
        type: "JOIN",
        payload: { invalid: "payload" },
      })
    ).toThrow();
  });

  it("should validate all message types", () => {
    const messages = [
      {
        type: "JOIN",
        payload: { name: "Alice", avatar: "avatar1" },
      },
      {
        type: "SEAT",
        payload: { playerId: "123e4567-e89b-12d3-a456-426614174000" },
      },
      {
        type: "START_SONG",
        payload: { trackUri: "spotify:track:abc123" },
      },
      {
        type: "PLACE",
        payload: {
          playerId: "123e4567-e89b-12d3-a456-426614174000",
          slotIndex: 0,
        },
      },
      {
        type: "CHALLENGE",
        payload: {
          playerId: "123e4567-e89b-12d3-a456-426614174000",
          targetPlayerId: "123e4567-e89b-12d3-a456-426614174001",
          slotIndex: 2,
        },
      },
      {
        type: "REVEAL",
        payload: { year: 1999 },
      },
      {
        type: "ROUND_SUMMARY",
        payload: { timeline: [], scores: {} },
      },
      {
        type: "CREATE_ROOM",
        payload: { gameMode: "original" },
      },
      {
        type: "ROOM_CREATED",
        payload: {
          roomKey: "123456",
          roomId: "123e4567-e89b-12d3-a456-426614174000",
        },
      },
      {
        type: "JOIN_ROOM",
        payload: { roomKey: "123456", name: "Alice", avatar: "avatar1" },
      },
      {
        type: "JOINED",
        payload: {
          playerId: "123e4567-e89b-12d3-a456-426614174000",
          roomKey: "123456",
          players: [],
        },
      },
      {
        type: "LEAVE",
        payload: { playerId: "123e4567-e89b-12d3-a456-426614174000" },
      },
      {
        type: "ROOM_STATE",
        payload: { players: [], roomKey: "123456" },
      },
      {
        type: "ERROR",
        payload: { code: "ERROR", message: "Error" },
      },
      {
        type: "PONG",
        payload: {},
      },
    ];

    for (const message of messages) {
      expect(() => MessageSchema.parse(message)).not.toThrow();
      expect(MessageSchema.parse(message)).toEqual(message);
    }
  });
});

describe("createMessage helper", () => {
  it("should create a typed JOIN message", () => {
    const message = createMessage("JOIN", { name: "Alice", avatar: "avatar1" });
    expect(message).toEqual({
      type: "JOIN",
      payload: { name: "Alice", avatar: "avatar1" },
    });
    expect(message.type).toBe("JOIN");
  });

  it("should create a typed START_SONG message", () => {
    const message = createMessage("START_SONG", {
      trackUri: "spotify:track:abc123",
      positionMs: 5000,
    });
    expect(message).toEqual({
      type: "START_SONG",
      payload: { trackUri: "spotify:track:abc123", positionMs: 5000 },
    });
  });
});

describe("parseMessage utility", () => {
  it("should parse valid message", () => {
    const message = {
      type: "JOIN",
      payload: { name: "Alice", avatar: "avatar1" },
    };
    expect(parseMessage(message)).toEqual(message);
  });

  it("should throw on invalid message", () => {
    expect(() => parseMessage({ type: "INVALID", payload: {} })).toThrow();
  });
});

describe("validateMessage utility", () => {
  it("should return success for valid message", () => {
    const message = {
      type: "JOIN",
      payload: { name: "Alice", avatar: "avatar1" },
    };
    const result = validateMessage(message);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(message);
    }
  });

  it("should return error for invalid message", () => {
    const result = validateMessage({ type: "INVALID", payload: {} });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });
});

describe("Type guards", () => {
  it("should correctly identify JOIN messages", () => {
    const message = createMessage("JOIN", { name: "Alice", avatar: "avatar1" });
    expect(isJoinMessage(message)).toBe(true);
    expect(isSeatMessage(message)).toBe(false);
  });

  it("should correctly identify SEAT messages", () => {
    const message = createMessage("SEAT", {
      playerId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(isSeatMessage(message)).toBe(true);
    expect(isJoinMessage(message)).toBe(false);
  });

  it("should correctly identify START_SONG messages", () => {
    const message = createMessage("START_SONG", {
      trackUri: "spotify:track:abc123",
    });
    expect(isStartSongMessage(message)).toBe(true);
    expect(isJoinMessage(message)).toBe(false);
  });

  it("should correctly identify PLACE messages", () => {
    const message = createMessage("PLACE", {
      playerId: "123e4567-e89b-12d3-a456-426614174000",
      slotIndex: 0,
    });
    expect(isPlaceMessage(message)).toBe(true);
    expect(isJoinMessage(message)).toBe(false);
  });

  it("should correctly identify CHALLENGE messages", () => {
    const message = createMessage("CHALLENGE", {
      playerId: "123e4567-e89b-12d3-a456-426614174000",
      targetPlayerId: "123e4567-e89b-12d3-a456-426614174001",
      slotIndex: 2,
    });
    expect(isChallengeMessage(message)).toBe(true);
    expect(isJoinMessage(message)).toBe(false);
  });

  it("should correctly identify REVEAL messages", () => {
    const message = createMessage("REVEAL", { year: 1999 });
    expect(isRevealMessage(message)).toBe(true);
    expect(isJoinMessage(message)).toBe(false);
  });

  it("should correctly identify ROUND_SUMMARY messages", () => {
    const message = createMessage("ROUND_SUMMARY", { timeline: [], scores: {} });
    expect(isRoundSummaryMessage(message)).toBe(true);
    expect(isJoinMessage(message)).toBe(false);
  });

  it("should correctly identify CREATE_ROOM messages", () => {
    const message = createMessage("CREATE_ROOM", { gameMode: "original" });
    expect(isCreateRoomMessage(message)).toBe(true);
    expect(isJoinMessage(message)).toBe(false);
  });

  it("should correctly identify ROOM_CREATED messages", () => {
    const message = createMessage("ROOM_CREATED", {
      roomKey: "123456",
      roomId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(isRoomCreatedMessage(message)).toBe(true);
    expect(isJoinMessage(message)).toBe(false);
  });

  it("should correctly identify JOIN_ROOM messages", () => {
    const message = createMessage("JOIN_ROOM", {
      roomKey: "123456",
      name: "Alice",
      avatar: "avatar1",
    });
    expect(isJoinRoomMessage(message)).toBe(true);
    expect(isJoinMessage(message)).toBe(false);
  });

  it("should correctly identify JOINED messages", () => {
    const message = createMessage("JOINED", {
      playerId: "123e4567-e89b-12d3-a456-426614174000",
      roomKey: "123456",
      players: [],
    });
    expect(isJoinedMessage(message)).toBe(true);
    expect(isJoinMessage(message)).toBe(false);
  });

  it("should correctly identify LEAVE messages", () => {
    const message = createMessage("LEAVE", {
      playerId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(isLeaveMessage(message)).toBe(true);
    expect(isJoinMessage(message)).toBe(false);
  });

  it("should correctly identify ROOM_STATE messages", () => {
    const message = createMessage("ROOM_STATE", {
      players: [],
      roomKey: "123456",
    });
    expect(isRoomStateMessage(message)).toBe(true);
    expect(isJoinMessage(message)).toBe(false);
  });

  it("should correctly identify ERROR messages", () => {
    const message = createMessage("ERROR", {
      code: "ERROR",
      message: "Something went wrong",
    });
    expect(isErrorMessage(message)).toBe(true);
    expect(isJoinMessage(message)).toBe(false);
  });

  it("should correctly identify PONG messages", () => {
    const message = createMessage("PONG", {});
    expect(isPongMessage(message)).toBe(true);
    expect(isJoinMessage(message)).toBe(false);
  });

  it("should narrow types correctly", () => {
    const message = createMessage("JOIN", { name: "Alice", avatar: "avatar1" });
    if (isJoinMessage(message)) {
      // TypeScript should narrow to JOIN message type
      expect(message.payload.name).toBe("Alice");
      expect(message.payload.avatar).toBe("avatar1");
    }
  });
});

