import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { auraFor } from "@/lib/aura";
import { fmtNum } from "@/lib/helpers";

export const PersonalRipple = ({ chain }) => {
  const aura = auraFor(chain?.tartan?.token || chain?.me?.share_token || "tartan");
  const { primary, secondary } = aura.palette;
  const me = chain?.me;
  const directs = (chain?.directs || []).slice(0, 12);

  const layout = useMemo(() => {
    const cx = 200, cy = 200, R = 128;
    return directs.map((d, i) => {
      const a = (i / Math.max(1, directs.length)) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      // downstream stars
      const stars = Math.min(8, d.downstream_count || 0);
      const starPts = Array.from({ length: stars }).map((_, s) => {
        const sa = a + (Math.random() - 0.5) * 0.9;
        const sr = 26 + Math.random() * 26;
        return { x: x + Math.cos(sa) * sr, y: y + Math.sin(sa) * sr };
      });
      return { d, x, y, a, starPts };
    });
  }, [directs]);

  const initial = (n) => (n || "?").trim().charAt(0).toUpperCase();

  return (
    <div
      className="relative rounded-2xl border border-slate-800 bg-[#070B14] overflow-hidden grain"
      data-testid="personal-ripple"
    >
      <div className="absolute top-3 left-4 z-10 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">
        Your ripple
      </div>
      <svg viewBox="0 0 400 400" className="w-full h-auto">
        <defs>
          <radialGradient id="ripple-core">
            <stop offset="0%" stopColor={primary} stopOpacity="0.9" />
            <stop offset="100%" stopColor={primary} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ripple-link" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={primary} />
            <stop offset="100%" stopColor={secondary} />
          </linearGradient>
        </defs>

        {/* concentric aura rings */}
        {[70, 108, 150].map((r, i) => (
          <circle key={i} cx="200" cy="200" r={r} fill="none" stroke={primary} strokeWidth="1" opacity={0.12} />
        ))}

        {/* connectors */}
        {layout.map(({ x, y }, i) => {
          const mx = (200 + x) / 2 + (200 - y) * 0.18;
          const my = (200 + y) / 2 + (x - 200) * 0.18;
          return (
            <motion.path
              key={i}
              d={`M 200 200 Q ${mx} ${my} ${x} ${y}`}
              fill="none"
              stroke="url(#ripple-link)"
              strokeWidth="1.4"
              opacity="0.7"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }}
            />
          );
        })}

        {/* downstream stars */}
        {layout.map(({ starPts }, i) =>
          starPts.map((p, s) => (
            <motion.circle
              key={`${i}-${s}`}
              cx={p.x}
              cy={p.y}
              r="1.6"
              fill={secondary}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 0.85, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.05 + s * 0.03 }}
            />
          ))
        )}

        {/* tier-1 direct nodes */}
        {layout.map(({ d, x, y }, i) => (
          <motion.g
            key={d.share_token}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.4 + i * 0.05 }}
          >
            <circle cx={x} cy={y} r="15" fill={secondary} fillOpacity="0.18" stroke={secondary} strokeWidth="1" />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#F0F6FF" fontFamily="Outfit, sans-serif">
              {initial(d.nickname)}
            </text>
            {d.downstream_count > 0 && (
              <text x={x} y={y + 27} textAnchor="middle" fontSize="8" fill={secondary} fontFamily="JetBrains Mono, monospace">
                +{fmtNum(d.downstream_count)}
              </text>
            )}
          </motion.g>
        ))}

        {/* center = YOU */}
        <circle cx="200" cy="200" r="46" fill="url(#ripple-core)" opacity="0.5" />
        <circle cx="200" cy="200" r="26" fill={primary} fillOpacity="0.15" stroke={primary} strokeWidth="1.5" className="animate-breathe" style={{ transformOrigin: "200px 200px" }} />
        <text x="200" y="197" textAnchor="middle" fontSize="14" fontWeight="800" fill={primary} fontFamily="Unbounded, sans-serif">
          {initial(me?.nickname)}
        </text>
        <text x="200" y="212" textAnchor="middle" fontSize="7" fill="#94A3B8" fontFamily="JetBrains Mono, monospace" letterSpacing="1">
          YOU
        </text>
      </svg>

      {directs.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-slate-500 text-sm text-center px-8">Share your link — the first spark you pass on appears here.</p>
        </div>
      )}
    </div>
  );
};
