import { useState, useEffect } from "react";
import { getUserPlaylists } from "../lib/spotify-api.js";

interface Playlist {
  id: string;
  name: string;
  owner: string;
  trackCount: number;
  imageUrl?: string;
}

interface PlaylistSelectorProps {
  accessToken: string;
  onSelect: (playlistId: string, playlistName: string) => void;
  selectedPlaylistId?: string;
}

export function PlaylistSelector({
  accessToken,
  onSelect,
  selectedPlaylistId,
}: PlaylistSelectorProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchPlaylists() {
      setLoading(true);
      setError(null);
      try {
        const allPlaylists: Playlist[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const response = await getUserPlaylists(accessToken, 50, offset);
          const items = response.items.map((item) => ({
            id: item.id,
            name: item.name,
            owner: item.owner.display_name,
            trackCount: item.tracks.total,
            imageUrl: item.images?.[0]?.url,
          }));
          allPlaylists.push(...items);

          if (response.next) {
            offset += 50;
          } else {
            hasMore = false;
          }
        }

        setPlaylists(allPlaylists);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch playlists";
        setError(errorMessage);
        console.error("Failed to fetch playlists:", err);
      } finally {
        setLoading(false);
      }
    }

    if (accessToken) {
      fetchPlaylists();
    }
  }, [accessToken]);

  const filteredPlaylists = playlists.filter((playlist) =>
    playlist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    playlist.owner.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
        <p className="text-sm text-gray-600">Loading playlists...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-800 font-medium mb-1">Error loading playlists</p>
        <p className="text-xs text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search playlists..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Playlist List */}
      <div className="max-h-96 overflow-y-auto space-y-2">
        {filteredPlaylists.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? "No playlists match your search" : "No playlists found"}
          </div>
        ) : (
          filteredPlaylists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => onSelect(playlist.id, playlist.name)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedPlaylistId === playlist.id
                  ? "bg-primary-100 border-primary-300"
                  : "bg-white border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-3">
                {playlist.imageUrl ? (
                  <img
                    src={playlist.imageUrl}
                    alt={playlist.name}
                    className="w-12 h-12 rounded object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center text-gray-400">
                    🎵
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{playlist.name}</p>
                  <p className="text-xs text-gray-600">
                    {playlist.owner} • {playlist.trackCount} tracks
                  </p>
                </div>
                {selectedPlaylistId === playlist.id && (
                  <span className="text-primary-600">✓</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

