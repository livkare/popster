import { motion } from "framer-motion";
import type { Card as CardType } from "@hitster/engine";

interface CardProps {
  card: CardType;
  slotIndex: number;
  isRevealed: boolean;
  isCorrect?: boolean;
  year?: number;
  albumArt?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function Card({
  card,
  slotIndex,
  isRevealed,
  isCorrect,
  year,
  albumArt,
  onClick,
  disabled,
}: CardProps) {
  const baseClasses =
    "w-24 h-32 rounded-lg shadow-md transition-all duration-300 cursor-pointer flex flex-col items-center justify-center relative overflow-hidden";
  const revealedClasses = isRevealed
    ? isCorrect
      ? "bg-green-100 border-2 border-green-500"
      : "bg-red-100 border-2 border-red-500"
    : "bg-gray-100 border-2 border-gray-300 hover:border-primary-400";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      className={`${baseClasses} ${revealedClasses} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      onClick={!disabled ? onClick : undefined}
      role="button"
      aria-label={isRevealed ? `Card ${year || "unknown"}` : "Place card"}
      tabIndex={disabled ? -1 : 0}
    >
      {isRevealed && albumArt ? (
        <img
          src={albumArt}
          alt={year ? `Album from ${year}` : "Album art"}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-2">
          <span className="text-4xl mb-2">🎵</span>
          {isRevealed && year !== undefined && (
            <span className="text-xs font-bold text-gray-700">{year}</span>
          )}
        </div>
      )}
      {isRevealed && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 text-center">
          {year || "?"}
        </div>
      )}
      {!isRevealed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl opacity-50">?</span>
        </div>
      )}
    </motion.div>
  );
}

