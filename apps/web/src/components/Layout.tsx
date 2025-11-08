import { ReactNode } from "react";
import { ConnectionStatus } from "./ConnectionStatus.js";
import { useConnectionStore } from "../store/index.js";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { error } = useConnectionStore();

  // Don't display join-related errors in Layout - they're handled locally in RoomPage/HostPage
  // to avoid duplicate error displays
  const shouldShowError = error && !error.includes("ROOM_NOT_FOUND") && !error.includes("JOIN_ROOM_FAILED");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Hitster</h1>
            <ConnectionStatus />
          </div>
        </div>
      </header>
      {shouldShowError && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-red-600">⚠️</span>
                <p className="text-sm text-red-800">{error}</p>
              </div>
              <button
                onClick={() => useConnectionStore.getState().setError(null)}
                className="text-red-600 hover:text-red-800 text-sm"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

