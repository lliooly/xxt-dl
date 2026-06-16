#!/usr/bin/env python3
from __future__ import annotations

import io
import struct
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError as error:
    raise SystemExit("Pillow is required: python3 -m pip install Pillow") from error


ROOT = Path(__file__).resolve().parents[1]
BUILD_DIR = ROOT / "build"
SOURCE_SVG = BUILD_DIR / "icon.svg"
ICON_PNG = BUILD_DIR / "icon.png"
ICON_ICO = BUILD_DIR / "icon.ico"
ICON_ICNS = BUILD_DIR / "icon.icns"

CANVAS_SIZE = 1024
DRAW_SCALE = 4
DRAW_SIZE = CANVAS_SIZE * DRAW_SCALE


def scaled(value: int) -> int:
    return value * DRAW_SCALE


def interpolate(start: tuple[int, int, int], end: tuple[int, int, int], ratio: float) -> tuple[int, int, int]:
    return tuple(round(start[i] + (end[i] - start[i]) * ratio) for i in range(3))


def make_gradient_square(size: int, radius: int) -> Image.Image:
    top_left = (20, 184, 216)
    bottom_right = (37, 99, 235)
    gradient = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pixels = gradient.load()
    for y in range(size):
        for x in range(size):
            ratio = (x + y) / (2 * (size - 1))
            color = interpolate(top_left, bottom_right, ratio)
            pixels[x, y] = (*color, 255)

    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    gradient.putalpha(mask)
    return gradient


def rounded_line(draw: ImageDraw.ImageDraw, xy: tuple[int, int, int, int], fill: tuple[int, int, int, int], width: int) -> None:
    draw.line(xy, fill=fill, width=width)
    radius = width // 2
    x1, y1, x2, y2 = xy
    draw.ellipse((x1 - radius, y1 - radius, x1 + radius, y1 + radius), fill=fill)
    draw.ellipse((x2 - radius, y2 - radius, x2 + radius, y2 + radius), fill=fill)


def draw_icon(size: int = DRAW_SIZE) -> Image.Image:
    scale = size / CANVAS_SIZE

    def s(value: int) -> int:
        return round(value * scale)

    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (s(86), s(96), s(938), s(956)),
        radius=s(205),
        fill=(15, 23, 42, 90),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(s(28)))
    icon.alpha_composite(shadow)

    base = make_gradient_square(s(852), s(205))
    icon.alpha_composite(base, (s(86), s(76)))

    highlight = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    highlight_draw = ImageDraw.Draw(highlight)
    highlight_draw.rounded_rectangle(
        (s(130), s(118), s(890), s(866)),
        radius=s(180),
        outline=(255, 255, 255, 34),
        width=s(6),
    )
    icon.alpha_composite(highlight)

    draw = ImageDraw.Draw(icon)

    paper_shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    paper_shadow_draw = ImageDraw.Draw(paper_shadow)
    paper_shadow_draw.rounded_rectangle(
        (s(285), s(224), s(642), s(724)),
        radius=s(52),
        fill=(15, 23, 42, 46),
    )
    paper_shadow = paper_shadow.filter(ImageFilter.GaussianBlur(s(10)))
    icon.alpha_composite(paper_shadow)

    paper = (248, 252, 255, 255)
    paper_edge = (216, 236, 255, 255)
    draw.rounded_rectangle((s(282), s(210), s(640), s(708)), radius=s(52), fill=paper)
    draw.polygon(
        [(s(548), s(210)), (s(640), s(302)), (s(548), s(302))],
        fill=paper_edge,
    )
    draw.line([(s(548), s(210)), (s(548), s(302)), (s(640), s(302))], fill=(196, 222, 248, 255), width=s(6))

    ink = (28, 116, 210, 255)
    accent = (14, 165, 160, 255)
    rounded_line(draw, (s(354), s(380), s(514), s(380)), fill=ink, width=s(24))
    rounded_line(draw, (s(354), s(466), s(522), s(466)), fill=ink, width=s(24))
    rounded_line(draw, (s(354), s(552), s(472), s(552)), fill=accent, width=s(24))

    white = (255, 255, 255, 255)
    rounded_line(draw, (s(672), s(430), s(672), s(604)), fill=white, width=s(58))
    draw.polygon(
        [(s(580), s(572)), (s(672), s(670)), (s(764), s(572))],
        fill=white,
    )
    rounded_line(draw, (s(548), s(722), s(796), s(722)), fill=white, width=s(48))
    rounded_line(draw, (s(548), s(672), s(548), s(722)), fill=white, width=s(48))
    rounded_line(draw, (s(796), s(672), s(796), s(722)), fill=white, width=s(48))

    return icon


def save_pngs(icon: Image.Image) -> None:
    resized = icon.resize((CANVAS_SIZE, CANVAS_SIZE), Image.Resampling.LANCZOS)
    resized.save(ICON_PNG)


def save_ico(icon: Image.Image) -> None:
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    resized = icon.resize((256, 256), Image.Resampling.LANCZOS)
    resized.save(ICON_ICO, sizes=sizes)


def png_bytes(icon: Image.Image, size: int) -> bytes:
    output = io.BytesIO()
    icon.resize((size, size), Image.Resampling.LANCZOS).save(output, format="PNG")
    return output.getvalue()


def save_icns(icon: Image.Image) -> None:
    entries = [
        ("icp4", 16),
        ("icp5", 32),
        ("icp6", 64),
        ("ic07", 128),
        ("ic08", 256),
        ("ic09", 512),
        ("ic10", 1024),
        ("ic11", 32),
        ("ic12", 64),
        ("ic13", 256),
        ("ic14", 512),
    ]

    chunks = []
    for chunk_type, size in entries:
        data = png_bytes(icon, size)
        chunks.append(chunk_type.encode("ascii") + struct.pack(">I", len(data) + 8) + data)

    payload = b"".join(chunks)
    ICON_ICNS.write_bytes(b"icns" + struct.pack(">I", len(payload) + 8) + payload)


def save_svg_source() -> None:
    SOURCE_SVG.write_text(
        """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="132" y1="116" x2="892" y2="908" gradientUnits="userSpaceOnUse">
      <stop stop-color="#14B8D8"/>
      <stop offset="1" stop-color="#2563EB"/>
    </linearGradient>
    <filter id="shadow" x="40" y="40" width="944" height="944" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#0F172A" flood-opacity=".28"/>
    </filter>
  </defs>
  <rect x="86" y="76" width="852" height="852" rx="205" fill="url(#bg)" filter="url(#shadow)"/>
  <rect x="282" y="210" width="358" height="498" rx="52" fill="#F8FCFF"/>
  <path d="M548 210 640 302h-92z" fill="#D8ECFF"/>
  <path d="M548 210v92h92" fill="none" stroke="#C4DEF8" stroke-width="6"/>
  <path d="M354 380h160M354 466h168" stroke="#1C74D2" stroke-width="24" stroke-linecap="round"/>
  <path d="M354 552h118" stroke="#0EA5A0" stroke-width="24" stroke-linecap="round"/>
  <path d="M672 430v174" stroke="#fff" stroke-width="58" stroke-linecap="round"/>
  <path d="M580 572 672 670l92-98z" fill="#fff"/>
  <path d="M548 672v50h248v-50" stroke="#fff" stroke-width="48" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>
""",
        encoding="utf-8",
    )


def main() -> None:
    BUILD_DIR.mkdir(exist_ok=True)
    icon = draw_icon()
    save_svg_source()
    save_pngs(icon)
    save_ico(icon)
    save_icns(icon)
    print(f"Generated {ICON_PNG.relative_to(ROOT)}, {ICON_ICO.relative_to(ROOT)}, {ICON_ICNS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
