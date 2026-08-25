"""
Generates RiskFlow's app icons (manifest icons, apple-touch-icon, favicon).

Run with: .venv/Scripts/python scripts/generate_icons.py
Requires Pillow (pip install Pillow) -- a dev-only tool, not a runtime dependency.
"""

from pathlib import Path

from PIL import Image, ImageDraw

BASE_DIR = Path(__file__).resolve().parent.parent
ICONS_DIR = BASE_DIR / 'scheduler' / 'static' / 'scheduler' / 'icons'

BG = '#1F6091'      # schedule blue
BAR_CRIT = '#E07B2C'  # risk amber
BAR_NORM = '#EEF1F4'  # paper

SUPERSAMPLE = 4


def draw_icon(size):
    n = size * SUPERSAMPLE
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    corner_radius = round(n * 0.22)
    draw.rounded_rectangle([0, 0, n - 1, n - 1], radius=corner_radius, fill=BG)

    # Three staggered Gantt bars -- the app's visual signature.
    bar_h = round(n * 0.09)
    gap = round(n * 0.065)
    left = round(n * 0.20)
    total_h = bar_h * 3 + gap * 2
    top = (n - total_h) // 2

    bars = [
        (left, top, n * 0.55, BAR_NORM),
        (left + n * 0.10, top + bar_h + gap, n * 0.62, BAR_NORM),
        (left, top + (bar_h + gap) * 2, n * 0.42, BAR_CRIT),
    ]
    radius = round(bar_h * 0.35)
    for x0, y0, x1, color in bars:
        draw.rounded_rectangle([x0, y0, x1, y0 + bar_h], radius=radius, fill=color)

    return img.resize((size, size), Image.LANCZOS)


def main():
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    targets = [
        ('icon-192.png', 192),
        ('icon-512.png', 512),
        ('apple-touch-icon.png', 180),
        ('favicon-32.png', 32),
        ('favicon-16.png', 16),
    ]
    for filename, size in targets:
        icon = draw_icon(size)
        icon.save(ICONS_DIR / filename)
        print('wrote', ICONS_DIR / filename)


if __name__ == '__main__':
    main()
