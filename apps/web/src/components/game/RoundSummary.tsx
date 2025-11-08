import { motion } from "framer-motion";
import type { RoundSummary as RoundSummaryType } from "@hitster/proto";
import { useRoomStore } from "../../store/index.js";

interface RoundSummaryProps {
  summary: RoundSummaryType;
  onContinue?: () => void;
}

export function RoundSummary({ summary, onContinue }: RoundSummaryProps) {
  const { players } = useRoomStore();

  // Sort players by score (descending)
  const sortedPlayers = [...players]
    .map((player) => ({
      ...player,
      score: summary.scores[player.id] || 0,
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Round Summary</h3>
        <p className="text-gray-600">Scores and timeline results</p>
      </div>

      {/* Timeline Results */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h4 className="text-lg font-semibold text-gray-900 mb-3">Timeline</h4>
        <div className="space-y-2">
          {summary.timeline
            .sort((a, b) => a.year - b.year)
            .map((entry, index) => {
              const player = players.find((p) => p.id === entry.playerId);
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600 w-12">
                      {entry.year}
                    </span>
                    <span className="text-sm text-gray-900">
                      {player?.name || "Unknown"}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Scores */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h4 className="text-lg font-semibold text-gray-900 mb-3">Scores</h4>
        <div className="space-y-2">
          {sortedPlayers.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between p-3 bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{player.avatar}</span>
                <span className="font-medium text-gray-900">{player.name}</span>
              </div>
              <span className="text-xl font-bold text-primary-700">
                {player.score}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {onContinue && (
        <div className="flex justify-center">
          <button
            onClick={onContinue}
            className="btn-primary px-8 py-3 text-lg"
          >
            Continue
          </button>
        </div>
      )}
    </motion.div>
  );
}

