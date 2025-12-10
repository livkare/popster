interface Player {
  id: string;
  name: string;
  avatar: string;
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
      {players.map((player) => (
        <div
          key={player.id}
          className="flex flex-col items-center p-4 bg-white rounded-lg shadow-sm"
        >
          <div
            className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary-700 mb-2"
            aria-label={`${player.name}'s avatar`}
          >
            {player.avatar || player.name.charAt(0).toUpperCase()}
          </div>
          <p className="text-sm font-medium text-gray-900 truncate w-full text-center">
            {player.name}
          </p>
        </div>
      ))}
    </div>
  );
}

