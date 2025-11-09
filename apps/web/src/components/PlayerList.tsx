interface Player {
  id: string;
  name: string;
  avatar: string;
  connected?: boolean;
}

interface PlayerListProps {
  players: Player[];
}

export function PlayerList({ players }: PlayerListProps) {
  if (players.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No players yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {players.map((player) => {
        const isConnected = player.connected !== false; // Default to true if not specified
        return (
          <div
            key={player.id}
            className={`flex flex-col items-center p-4 bg-white rounded-lg shadow-sm ${
              !isConnected ? "opacity-60" : ""
            }`}
          >
            <div className="relative">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold mb-2 ${
                  isConnected
                    ? "bg-primary-100 text-primary-700"
                    : "bg-gray-200 text-gray-500"
                }`}
                aria-label={`${player.name}'s avatar`}
              >
                {player.avatar || player.name.charAt(0).toUpperCase()}
              </div>
              {!isConnected && (
                <div
                  className="absolute -top-1 -right-1 w-4 h-4 bg-gray-400 rounded-full border-2 border-white"
                  title="Offline"
                  aria-label="Player is offline"
                />
              )}
            </div>
            <p
              className={`text-sm font-medium truncate w-full text-center ${
                isConnected ? "text-gray-900" : "text-gray-500"
              }`}
            >
              {player.name}
            </p>
            {!isConnected && (
              <p className="text-xs text-gray-400 mt-1">Offline</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

