export function fmtNum(n) {
  if (n == null) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + "K";
  return String(n);
}

const AV_GRADS = [
  ["#00F0FF", "#0066FF"],
  ["#00FF66", "#00B3A6"],
  ["#FFB800", "#FF5E00"],
  ["#FF2A55", "#B026FF"],
  ["#7C3AED", "#00F0FF"],
  ["#22D3EE", "#34D399"],
];

export function avatarFor(name) {
  const key = (name || "?").trim();
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const grad = AV_GRADS[hash % AV_GRADS.length];
  const initials = key
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
  return { grad, initials };
}

export function timeAgo(iso) {  if (!iso) return "";
  const d = new Date(iso);
  const s = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}d`;
}

export function mediaUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${process.env.REACT_APP_BACKEND_URL}${path}`;
}

// Public share link — unfurls into a live server-rendered poster in link previews.
export function shareUrl(token) {
  return `${process.env.REACT_APP_BACKEND_URL}/api/s/${token}`;
}

// One-tap "share my poster": shares the share-card link (whose preview IS the poster).
export async function shareChain({ token, reach, tartanTitle }) {
  const url = shareUrl(token);
  const text = reach > 0
    ? `My Tartan chain has reached ${fmtNum(reach)} people. Join me and keep it moving:`
    : `I'm in — join me on Tartan and let's see how far this goes:`;
  if (navigator.share) {
    try {
      await navigator.share({ title: tartanTitle || "Tartan", text, url });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch (e) {
    return "failed";
  }
}
