import { create } from "zustand";
import type { TimelineEntry } from "@hitster/engine";

interface PlayerState {
  myPlayerId: string | null;
  myTokens: number;
  myTimeline: TimelineEntry[];
}

interface PlayerActions {
  setPlayerId: (playerId: string | null) => void;
  updateTokens: (tokens: number) => void;
  updateTimeline: (timeline: TimelineEntry[]) => void;
  reset: () => void;
}

type PlayerStore = PlayerState & PlayerActions;

const initialState: PlayerState = {
  myPlayerId: null,
  myTokens: 0,
  myTimeline: [],
};

export const usePlayerStore = create<PlayerStore>((set) => ({
  ...initialState,
  setPlayerId: (playerId) => set({ myPlayerId: playerId }),
  updateTokens: (tokens) => set({ myTokens: tokens }),
  updateTimeline: (timeline) => set({ myTimeline: timeline }),
  reset: () => set(initialState),
}));

