interface CurrentSongInfoProps {
  trackUri?: string;
  trackName?: string;
  artistName?: string;
  albumArt?: string;
}

export function CurrentSongInfo({
  trackUri,
  trackName,
  artistName,
  albumArt,
}: CurrentSongInfoProps) {
  if (!trackUri) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg border border-primary-200">
      {albumArt ? (
        <img
          src={albumArt}
          alt={trackName || "Now playing"}
          className="w-16 h-16 rounded-lg object-cover"
        />
      ) : (
        <div className="w-16 h-16 rounded-lg bg-primary-200 flex items-center justify-center">
          <span className="text-2xl">🎵</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">
          {trackName || "Unknown Track"}
        </p>
        <p className="text-sm text-gray-600 truncate">
          {artistName || "Unknown Artist"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-xs text-gray-600">Playing</span>
      </div>
    </div>
  );
}

