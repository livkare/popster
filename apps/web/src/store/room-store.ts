import { create } from "zustand";
import type { GameState } from "@hitster/engine";
import type { RoundSummary } from "@hitster/proto";
import type { TrackMetadata } from "../lib/spotify-api.js";

interface Player {
  id: string;
  name: string;
  avatar: string;
  connected?: boolean;
}

interface SelectedPlaylist {
  id: string;
  name: string;
  trackCount: number;
}

interface RoomState {
  roomKey: string | null;
  roomId: string | null;
  players: Player[];
  gameState: GameState | null;
  isHost: boolean;
  gameMode: string | null;
  roundSummary: RoundSummary | null;
  selectedPlaylist: SelectedPlaylist | null;
  playlistTracks: TrackMetadata[];
}

interface RoomActions {
  setRoom: (roomKey: string, roomId: string, gameMode: string) => void;
  updatePlayers: (players: Player[]) => void;
  updateGameState: (gameState: GameState | null) => void;
  setIsHost: (isHost: boolean) => void;
  setRoundSummary: (summary: RoundSummary | null) => void;
  setPlaylist: (playlist: SelectedPlaylist | null) => void;
  setPlaylistTracks: (tracks: TrackMetadata[]) => void;
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
  selectedPlaylist: null,
  playlistTracks: [],
};

export const useRoomStore = create<RoomStore>((set) => ({
  ...initialState,
  setRoom: (roomKey, roomId, gameMode) => set({ roomKey, roomId, gameMode }),
  updatePlayers: (players) => set({ players }),
  updateGameState: (gameState) => set({ gameState }),
  setIsHost: (isHost) => set({ isHost }),
  setRoundSummary: (summary) => set({ roundSummary: summary }),
  setPlaylist: (playlist) => set({ selectedPlaylist: playlist }),
  setPlaylistTracks: (tracks) => set({ playlistTracks: tracks }),
  reset: () => set(initialState),
}));

