import { create } from "zustand";
import type { GameState } from "@hitster/engine";
import type { RoundSummary } from "@hitster/proto";

interface Player {
  id: string;
  name: string;
  avatar: string;
}

interface RoomState {
  roomKey: string | null;
  roomId: string | null;
  players: Player[];
  gameState: GameState | null;
  isHost: boolean;
  gameMode: string | null;
  roundSummary: RoundSummary | null;
}

interface RoomActions {
  setRoom: (roomKey: string, roomId: string, gameMode: string) => void;
  updatePlayers: (players: Player[]) => void;
  updateGameState: (gameState: GameState | null) => void;
  setIsHost: (isHost: boolean) => void;
  setRoundSummary: (summary: RoundSummary | null) => void;
  reset: () => void;
}

type RoomStore = RoomState & RoomActions;

const initialState: RoomState = {
  roomKey: null,
  roomId: null,
  players: [],
  gameState: null,
  isHost: false,
  gameMode: null,
  roundSummary: null,
};

export const useRoomStore = create<RoomStore>((set) => ({
  ...initialState,
  setRoom: (roomKey, roomId, gameMode) => set({ roomKey, roomId, gameMode }),
  updatePlayers: (players) => set({ players }),
  updateGameState: (gameState) => set({ gameState }),
  setIsHost: (isHost) => set({ isHost }),
  setRoundSummary: (summary) => set({ roundSummary: summary }),
  reset: () => set(initialState),
}));

