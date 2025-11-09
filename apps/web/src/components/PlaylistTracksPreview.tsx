import { TrackMetadata } from "../lib/spotify-api.js";

interface PlaylistTracksPreviewProps {
  tracks: TrackMetadata[];
  playlistName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function PlaylistTracksPreview({
  tracks,
  playlistName,
  onConfirm,
  onCancel,
  loading = false,
}: PlaylistTracksPreviewProps) {
  const tracksWithYear = tracks.filter((t) => t.releaseYear !== null);
  const tracksWithoutYear = tracks.filter((t) => t.releaseYear === null);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{playlistName}</h3>
        <p className="text-sm text-gray-600">
          {tracks.length} tracks • {tracksWithYear.length} with release year
        </p>
        {tracksWithoutYear.length > 0 && (
          <p className="text-xs text-yellow-700 mt-1">
            ⚠️ {tracksWithoutYear.length} tracks missing release year (will be skipped in game)
          </p>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
        {tracks.slice(0, 20).map((track, index) => (
          <div
            key={track.trackUri}
            className="flex items-center gap-3 text-sm"
          >
            <span className="text-gray-500 w-6">{index + 1}.</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{track.name}</p>
              <p className="text-xs text-gray-600 truncate">
                {track.artist}
                {track.releaseYear && ` • ${track.releaseYear}`}
                {!track.releaseYear && " • No release year"}
              </p>
            </div>
          </div>
        ))}
        {tracks.length > 20 && (
          <p className="text-xs text-gray-500 text-center pt-2">
            ... and {tracks.length - 20} more tracks
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 btn-secondary"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading || tracksWithYear.length < 10}
          className="flex-1 btn-primary"
        >
          {loading ? "Confirming..." : "Confirm Selection"}
        </button>
      </div>

      {tracksWithYear.length < 10 && (
        <p className="text-xs text-red-700 text-center">
          Playlist must have at least 10 tracks with release year information
        </p>
      )}
    </div>
  );
}

