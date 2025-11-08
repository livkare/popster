import { create } from "zustand";

interface SpotifyState {
  isAuthenticated: boolean;
  isPremium: boolean | null; // null = unknown, true = premium, false = not premium
  deviceId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
}

interface SpotifyActions {
  setAuth: (accessToken: string, refreshToken: string) => void;
  setDeviceId: (deviceId: string | null) => void;
  setPremium: (isPremium: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

type SpotifyStore = SpotifyState & SpotifyActions;

const initialState: SpotifyState = {
  isAuthenticated: false,
  isPremium: null,
  deviceId: null,
  accessToken: null,
  refreshToken: null,
  error: null,
};

export const useSpotifyStore = create<SpotifyStore>((set) => ({
  ...initialState,
  setAuth: (accessToken, refreshToken) =>
    set({ isAuthenticated: true, accessToken, refreshToken, error: null }),
  setDeviceId: (deviceId) => set({ deviceId }),
  setPremium: (isPremium) => set({ isPremium }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));

