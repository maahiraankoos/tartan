import React, { useMemo } from "react";
import { auraFor, polyPoints } from "@/lib/aura";

// A deterministic "sacred geometry" sigil for a chain seed.
export const ChainSigil = ({ seed, size = 96, glowing = true, className }) => {
  const aura = useMemo(() => auraFor(seed), [seed]);
  const { palette, sides, rotation, rings, rune } = aura;
  const c = size / 2;
  const R = size * 0.36;

  const outer = polyPoints(c, c, R, sides, rotation);
  const inner = polyPoints(c, c, R * 0.55, sides, rotation + 25);
  const gid = `sig-${aura.hash}`;

  const runeStroke = () => {
    const pts = polyPoints(c, c, R * 0.85, sides, rotation);
    if (rune === 1) {
      // diamonds at vertices
      return pts.map(([x, y], i) => (
        <rect key={i} x={x - 2.5} y={y - 2.5} width="5" height="5" transform={`rotate(45 ${x} ${y})`} fill={palette.secondary} />
      ));
    }
    if (rune === 2) {
      // s-curves from center to vertices
      return pts.map(([x, y], i) => (
        <path key={i} d={`M ${c} ${c} Q ${(c + x) / 2 + 6} ${(c + y) / 2 - 6} ${x} ${y}`} stroke={palette.secondary} strokeWidth="1" fill="none" opacity="0.7" />
      ));
    }
    // zigzag spokes
    return pts.map(([x, y], i) => (
      <line key={i} x1={c} y1={c} x2={x} y2={y} stroke={palette.secondary} strokeWidth="1" opacity="0.6" />
    ));
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={glowing ? { color: palette.primary, filter: `drop-shadow(0 0 10px ${palette.primary}66)` } : {}}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.primary} />
          <stop offset="100%" stopColor={palette.secondary} />
        </linearGradient>
        <radialGradient id={`${gid}-core`}>
          <stop offset="0%" stopColor={palette.primary} stopOpacity="0.9" />
          <stop offset="100%" stopColor={palette.primary} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* orbit rings */}
      {Array.from({ length: rings }).map((_, i) => (
        <circle
          key={i}
          cx={c}
          cy={c}
          r={R * (1.08 + i * 0.18)}
          fill="none"
          stroke={palette.primary}
          strokeWidth="1"
          strokeDasharray={i % 2 ? "3 6" : "1 5"}
          opacity={0.4 - i * 0.08}
          className={i % 2 ? "spin-slow" : "spin-slow-rev"}
          style={{ transformOrigin: "center" }}
        />
      ))}

      <circle cx={c} cy={c} r={R * 1.4} fill={`url(#${gid}-core)`} opacity="0.35" />

      {/* outer polygon */}
      <polygon
        points={outer.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* inner polygon */}
      <polygon
        points={inner.map((p) => p.join(",")).join(" ")}
        fill={palette.primary}
        fillOpacity="0.12"
        stroke={palette.secondary}
        strokeWidth="1"
      />

      {runeStroke()}

      {/* core node */}
      <circle cx={c} cy={c} r={size * 0.05} fill={palette.primary}>
        <animate attributeName="r" values={`${size * 0.045};${size * 0.065};${size * 0.045}`} dur="2.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
};
