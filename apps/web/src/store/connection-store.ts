import { create } from "zustand";

interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

interface ConnectionActions {
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

type ConnectionStore = ConnectionState & ConnectionActions;

const initialState: ConnectionState = {
  connected: false,
  connecting: false,
  error: null,
};

export const useConnectionStore = create<ConnectionStore>((set) => ({
  ...initialState,
  setConnected: (connected) => set({ connected, connecting: false }),
  setConnecting: (connecting) =>
    set((state) => ({
      connecting,
      // Only set connected to false when starting to connect, preserve it when stopping connecting
      connected: connecting ? false : state.connected,
    })),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));

