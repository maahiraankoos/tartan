// Deterministic visual identity ("aura" + sigil geometry) from a seed string.

const PALETTES = [
  { name: "Quantum Cyan", primary: "#00F0FF", secondary: "#00FF66" },
  { name: "Solar Gold", primary: "#FFB800", secondary: "#FF2A55" },
  { name: "Violet Plasma", primary: "#A855F7", secondary: "#00F0FF" },
  { name: "Emerald Volt", primary: "#00FF66", secondary: "#FFB800" },
  { name: "Rose Ion", primary: "#FF2A55", secondary: "#A855F7" },
  { name: "Ice Lime", primary: "#7DF9FF", secondary: "#00FF66" },
];

export function hashSeed(seed) {
  const s = String(seed || "tartan");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function auraFor(seed) {
  const h = hashSeed(seed);
  const palette = PALETTES[h % PALETTES.length];
  const sides = 3 + ((h >> 3) % 6); // 3..8
  const rotation = (h >> 6) % 360;
  const rings = 2 + ((h >> 9) % 2); // 2..3
  const rune = (h >> 11) % 3; // 0 zigzag, 1 diamond, 2 s-curve
  const spin = 16 + ((h >> 13) % 14);
  return { palette, sides, rotation, rings, rune, spin, hash: h };
}

// polygon points on a circle
export function polyPoints(cx, cy, r, sides, rotDeg = 0) {
  const pts = [];
  const rot = (rotDeg * Math.PI) / 180;
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2 - Math.PI / 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}
