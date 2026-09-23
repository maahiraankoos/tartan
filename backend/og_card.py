"""Server-side share-card (OG image) renderer for Tartan.

Produces a 1200x630 PNG that unfurls in link previews (WhatsApp, iMessage,
X, LinkedIn, Slack, etc). Pure Pillow — no external services.
"""
import os
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont

FONT_DIR = os.path.join(os.path.dirname(__file__), "assets", "fonts")
OUTFIT = os.path.join(FONT_DIR, "Outfit-VF.ttf")
MONO = os.path.join(FONT_DIR, "SpaceMono-Bold.ttf")

W, H = 1200, 630

# Curated neon palette pairs (primary, secondary) matching the app aesthetic.
PALETTES = [
    ("#00F0FF", "#34D399"),
    ("#A78BFA", "#22D3EE"),
    ("#FB7185", "#FBBF24"),
    ("#34D399", "#A3E635"),
    ("#60A5FA", "#C084FC"),
    ("#F472B6", "#818CF8"),
    ("#FBBF24", "#FB923C"),
    ("#2DD4BF", "#38BDF8"),
]


def palette_for(seed: str):
    h = 0
    for ch in (seed or "tartan"):
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return PALETTES[h % len(PALETTES)]


def _hex(c: str):
    c = c.lstrip("#")
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16))


@lru_cache(maxsize=64)
def _outfit(size: int, weight: int = 700):
    f = ImageFont.truetype(OUTFIT, size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass
    return f


@lru_cache(maxsize=16)
def _mono(size: int):
    return ImageFont.truetype(MONO, size)


def _glow(base, cx, cy, radius, rgb, max_alpha=70):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    steps = 42
    for i in range(steps, 0, -1):
        r = radius * i / steps
        a = int(max_alpha * (1 - i / steps) ** 1.4)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgb + (a,))
    base.alpha_composite(layer)


def _wrap(draw, text, font, max_w, max_lines=2):
    words = str(text).split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if draw.textlength(test, font=font) <= max_w or not cur:
            cur = test
        else:
            lines.append(cur)
            cur = w
            if len(lines) == max_lines:
                break
    if cur and len(lines) < max_lines:
        lines.append(cur)
    if len(lines) == max_lines and words:
        # ellipsize last line if truncated
        joined = " ".join(lines)
        if joined != text:
            while lines[-1] and draw.textlength(lines[-1] + "…", font=font) > max_w:
                lines[-1] = lines[-1][:-1]
            lines[-1] = lines[-1].rstrip() + "…"
    return lines


def _fmt(n: int) -> str:
    return f"{int(n):,}"


def render_card(data: dict, node_initials=None) -> bytes:
    primary = _hex(data["primary"])
    secondary = _hex(data["secondary"])
    nickname = (data.get("nickname") or "Someone")[:16]
    reach = data.get("reach", 0)
    spark = data.get("spark_number")
    rank = data.get("rank")
    pct = data.get("percentile")
    title = data.get("title") or "Tartan chain"
    category = (data.get("category_label") or "").upper()

    img = Image.new("RGBA", (W, H), (9, 12, 22, 255))
    _glow(img, 210, 180, 520, primary, 66)
    _glow(img, 1010, 560, 520, secondary, 54)
    draw = ImageDraw.Draw(img)

    # subtle border
    draw.rectangle([28, 28, W - 28, H - 28], outline=primary + (70,), width=2)

    x0 = 80
    # header
    draw.ellipse([x0, 79, x0 + 17, 96], fill=primary)
    draw.text((x0 + 30, 66), "TARTAN", font=_mono(28), fill=primary)
    if category:
        cw = draw.textlength(category, font=_mono(22))
        draw.text((W - 80 - cw, 70), category, font=_mono(22), fill=(148, 163, 184))

    # inviter line
    draw.text((x0, 150), f"{nickname.upper()} INVITED YOU", font=_mono(26), fill=secondary)

    # giant reach number
    num = _fmt(reach)
    num_font = _outfit(132, 800)
    draw.text((x0, 190), num, font=num_font, fill=primary)
    nw = draw.textlength(num, font=num_font)
    lbl_font = _outfit(36, 600)
    draw.text((x0 + nw + 26, 232), "people", font=lbl_font, fill=(226, 232, 240))
    draw.text((x0 + nw + 26, 278), "reached", font=lbl_font, fill=(148, 163, 184))

    # chain title (wrapped)
    ty = 372
    tfont = _outfit(42, 700)
    for line in _wrap(draw, title, tfont, 620, 2):
        draw.text((x0, ty), line, font=tfont, fill=(240, 246, 255))
        ty += 52

    # spark / rank chips
    chip_y = max(ty + 12, 486)
    chip = f"SPARK #{spark if spark is not None else '-'}"
    if rank:
        chip += f"    RANK #{rank}  \u00b7  TOP {pct}%"
    draw.text((x0, chip_y), chip, font=_mono(24), fill=(148, 163, 184))

    # footer CTA
    draw.text((x0, 548), "Tap to join and keep it moving  \u2192", font=_outfit(30, 700), fill=secondary)

    # right-side ripple graphic
    cx, cy = 950, 296
    for r in (66, 116, 166, 212):
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=primary + (60,), width=2)
    inits = (node_initials or [])[:8]
    import math
    ring = 166
    for i in range(8):
        a = (i / 8) * math.tau - math.pi / 2
        nx, ny = cx + math.cos(a) * ring, cy + math.sin(a) * ring
        draw.line([cx, cy, nx, ny], fill=secondary + (90,), width=2)
        draw.ellipse([nx - 24, ny - 24, nx + 24, ny + 24], fill=secondary + (46,), outline=secondary, width=2)
        letter = inits[i] if i < len(inits) else ""
        if letter:
            f = _outfit(26, 700)
            lw = draw.textlength(letter, font=f)
            draw.text((nx - lw / 2, ny - 17), letter, font=f, fill=(240, 246, 255))
    # center YOU/inviter node
    _glow(img, cx, cy, 120, primary, 90)
    draw = ImageDraw.Draw(img)
    draw.ellipse([cx - 46, cy - 46, cx + 46, cy + 46], fill=primary + (46,), outline=primary, width=3)
    ci = nickname[:1].upper()
    f = _outfit(38, 800)
    lw = draw.textlength(ci, font=f)
    draw.text((cx - lw / 2, cy - 28), ci, font=f, fill=primary)

    import io
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="PNG", optimize=True)
    return buf.getvalue()
