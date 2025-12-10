// Export all schemas
export * from "./messages.js";

// Re-export Zod for convenience
export { z } from "zod";

// Export validation utilities
import { MessageSchema, type Message } from "./messages.js";
import type { z } from "zod";

/**
 * Validates and parses a message from unknown input.
 * @throws {z.ZodError} if the message is invalid
 */
export function parseMessage(message: unknown): Message {
  return MessageSchema.parse(message);
}

/**
 * Safely validates a message and returns a result.
 * @returns { success: true, data: Message } | { success: false, error: z.ZodError }
 */
export function validateMessage(
  message: unknown
): { success: true; data: Message } | { success: false; error: z.ZodError } {
  const result = MessageSchema.safeParse(message);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// Type guards
export function isJoinMessage(msg: Message): msg is Extract<Message, { type: "JOIN" }> {
  return msg.type === "JOIN";
}

export function isSeatMessage(msg: Message): msg is Extract<Message, { type: "SEAT" }> {
  return msg.type === "SEAT";
}

export function isStartSongMessage(
  msg: Message
): msg is Extract<Message, { type: "START_SONG" }> {
  return msg.type === "START_SONG";
}

export function isPlaceMessage(msg: Message): msg is Extract<Message, { type: "PLACE" }> {
  return msg.type === "PLACE";
}

export function isChallengeMessage(
  msg: Message
): msg is Extract<Message, { type: "CHALLENGE" }> {
  return msg.type === "CHALLENGE";
}

export function isRevealMessage(
  msg: Message
): msg is Extract<Message, { type: "REVEAL" }> {
  return msg.type === "REVEAL";
}

export function isStartRoundMessage(
  msg: Message
): msg is Extract<Message, { type: "START_ROUND" }> {
  return msg.type === "START_ROUND";
}

export function isRoundSummaryMessage(
  msg: Message
): msg is Extract<Message, { type: "ROUND_SUMMARY" }> {
  return msg.type === "ROUND_SUMMARY";
}

export function isCreateRoomMessage(
  msg: Message
): msg is Extract<Message, { type: "CREATE_ROOM" }> {
  return msg.type === "CREATE_ROOM";
}

export function isRoomCreatedMessage(
  msg: Message
): msg is Extract<Message, { type: "ROOM_CREATED" }> {
  return msg.type === "ROOM_CREATED";
}

export function isJoinRoomMessage(
  msg: Message
): msg is Extract<Message, { type: "JOIN_ROOM" }> {
  return msg.type === "JOIN_ROOM";
}

export function isJoinedMessage(
  msg: Message
): msg is Extract<Message, { type: "JOINED" }> {
  return msg.type === "JOINED";
}

export function isLeaveMessage(msg: Message): msg is Extract<Message, { type: "LEAVE" }> {
  return msg.type === "LEAVE";
}

export function isRoomStateMessage(
  msg: Message
): msg is Extract<Message, { type: "ROOM_STATE" }> {
  return msg.type === "ROOM_STATE";
}

export function isErrorMessage(msg: Message): msg is Extract<Message, { type: "ERROR" }> {
  return msg.type === "ERROR";
}

export function isPongMessage(msg: Message): msg is Extract<Message, { type: "PONG" }> {
  return msg.type === "PONG";
}

export function isRegisterDeviceMessage(
  msg: Message
): msg is Extract<Message, { type: "REGISTER_DEVICE" }> {
  return msg.type === "REGISTER_DEVICE";
}

export function isDeviceRegisteredMessage(
  msg: Message
): msg is Extract<Message, { type: "DEVICE_REGISTERED" }> {
  return msg.type === "DEVICE_REGISTERED";
}
