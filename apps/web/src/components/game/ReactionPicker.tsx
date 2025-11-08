import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ReactionPickerProps {
  onReaction?: (reaction: string) => void;
  disabled?: boolean;
}

const REACTIONS = ["🔥", "💃", "🤔", "😎", "🎉", "👏"];

export function ReactionPicker({ onReaction, disabled }: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleReaction = (reaction: string) => {
    if (!disabled && onReaction) {
      onReaction(reaction);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="px-4 py-2 bg-primary-100 hover:bg-primary-200 rounded-lg text-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Pick a reaction"
        aria-expanded={isOpen}
      >
        😊 React
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -10 }}
              className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-20 flex gap-2"
            >
              {REACTIONS.map((reaction) => (
                <button
                  key={reaction}
                  onClick={() => handleReaction(reaction)}
                  className="w-10 h-10 text-2xl hover:scale-125 transition-transform focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
                  aria-label={`React with ${reaction}`}
                >
                  {reaction}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

