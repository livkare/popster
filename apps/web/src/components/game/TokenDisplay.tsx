interface TokenDisplayProps {
  tokens: number;
  maxTokens?: number;
}

export function TokenDisplay({ tokens, maxTokens }: TokenDisplayProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <span className="text-2xl" role="img" aria-label="Token">
          🪙
        </span>
        <span className="text-lg font-semibold text-gray-900">{tokens}</span>
      </div>
      {maxTokens !== undefined && (
        <span className="text-sm text-gray-500">/ {maxTokens}</span>
      )}
    </div>
  );
}

