interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Logo({ size = "md", className = "" }: LogoProps) {
  const sizeClasses = {
    sm: "w-16 h-16 text-2xl",
    md: "w-24 h-24 text-3xl",
    lg: "w-32 h-32 text-4xl",
    xl: "w-48 h-48 text-6xl",
  };

  const letterSizeClasses = {
    sm: "text-3xl",
    md: "text-5xl",
    lg: "text-7xl",
    xl: "text-9xl",
  };

  const crownSizeClasses = {
    sm: "text-lg -top-1",
    md: "text-xl -top-1.5",
    lg: "text-2xl -top-2",
    xl: "text-3xl -top-3",
  };

  const noteSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
    xl: "text-lg",
  };

  // Decorative elements positions (relative to container) - more scattered like confetti
  const decorations = [
    { symbol: "♪", color: "text-pink-400", left: "12%", top: "18%", delay: "0s" },
    { symbol: "♫", color: "text-purple-400", left: "28%", top: "55%", delay: "0.2s" },
    { symbol: "♪", color: "text-cyan-400", left: "72%", top: "22%", delay: "0.4s" },
    { symbol: "♫", color: "text-blue-400", left: "85%", top: "62%", delay: "0.6s" },
    { symbol: "★", color: "text-yellow-400", left: "18%", top: "78%", delay: "0.8s" },
    { symbol: "☆", color: "text-pink-300", left: "78%", top: "12%", delay: "1s" },
    { symbol: "●", color: "text-purple-300", left: "48%", top: "8%", delay: "1.2s" },
    { symbol: "◆", color: "text-cyan-300", left: "42%", top: "82%", delay: "1.4s" },
    { symbol: "♪", color: "text-yellow-300", left: "35%", top: "30%", delay: "1.6s" },
    { symbol: "●", color: "text-blue-300", left: "65%", top: "50%", delay: "1.8s" },
    { symbol: "★", color: "text-pink-200", left: "55%", top: "25%", delay: "2s" },
  ];

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      {/* Glowing circular border with neon effect */}
      <div className="absolute inset-0 rounded-full" style={{
        background: "linear-gradient(135deg, #a855f7, #ec4899, #06b6d4, #3b82f6)",
        padding: "3px",
        filter: "blur(0.5px) drop-shadow(0 0 8px rgba(168, 85, 247, 0.6))",
      }}>
        <div className="w-full h-full rounded-full bg-gray-900 relative overflow-hidden">
          {/* Decorative elements inside the circle */}
          {decorations.map((dec, i) => (
            <div
              key={i}
              className={`absolute ${dec.color} ${noteSizeClasses[size]} animate-float opacity-70`}
              style={{
                left: dec.left,
                top: dec.top,
                animationDelay: dec.delay,
                filter: "drop-shadow(0 0 2px currentColor)",
              }}
            >
              {dec.symbol}
            </div>
          ))}

          {/* PQ Letters */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative flex items-center gap-1">
              {/* Letter P with Crown */}
              <div className="relative">
                {/* Crown on P - positioned above */}
                <div
                  className={`absolute left-1/2 -translate-x-1/2 ${crownSizeClasses[size]} text-yellow-400 z-20`}
                  style={{ 
                    filter: "drop-shadow(0 0 6px rgba(234, 179, 8, 1)) drop-shadow(0 0 12px rgba(234, 179, 8, 0.6))",
                    textShadow: "0 0 8px rgba(234, 179, 8, 0.8)",
                  }}
                >
                  ♔
                </div>
                {/* Letter P with bubbly 3D effect */}
                <span
                  className={`${letterSizeClasses[size]} font-display relative z-10 text-bubbly-pink`}
                  style={{
                    fontFamily: "'Bubblegum Sans', 'Fredoka', cursive",
                  }}
                >
                  P
                </span>
              </div>

              {/* Letter Q with bubbly 3D effect */}
              <span
                className={`${letterSizeClasses[size]} font-display relative z-10 text-bubbly-cyan`}
                style={{
                  fontFamily: "'Bubblegum Sans', 'Fredoka', cursive",
                }}
              >
                Q
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

