import { QRCode } from "../QRCode.js";
import { PlayerList } from "../PlayerList.js";
import { TokenDisplay } from "./TokenDisplay.js";
import { useRoomStore, usePlayerStore } from "../../store/index.js";

interface LobbyScreenProps {
  roomKey: string;
  onStartGame?: () => void;
  canStartGame?: boolean;
  startGameDisabled?: boolean;
}

export function LobbyScreen({
  roomKey,
  onStartGame,
  canStartGame = false,
  startGameDisabled = false,
}: LobbyScreenProps) {
  const { players, isHost } = useRoomStore();
  const { myTokens } = usePlayerStore();

  return (
    <div className="space-y-6">
      {/* QR Code */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Share Room</h3>
        <QRCode roomKey={roomKey} />
      </div>

      {/* Players */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Players ({players.length})
        </h3>
        <PlayerList players={players} />
      </div>

      {/* My Tokens */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Tokens</h3>
        <TokenDisplay tokens={myTokens} />
      </div>

      {/* Start Game Button (Host Only) */}
      {isHost && canStartGame && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Start Game</h3>
          {(() => {
            const devMode = import.meta.env.DEV;
            const needsPlayers = !devMode && players.length < 1;
            return (
              <>
                {needsPlayers && (
                  <p className="text-sm text-yellow-600 mb-4">
                    Need at least 1 player to start
                  </p>
                )}
                <button
                  onClick={onStartGame}
                  disabled={startGameDisabled || needsPlayers}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {needsPlayers
                    ? "Need at least 1 player"
                    : "Start Game"}
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

