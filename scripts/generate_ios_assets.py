"""
Generates the source images @capacitor/assets needs to produce the full iOS
icon set and launch screens: a flat 1024x1024 app icon (no rounded corners,
no alpha -- iOS masks the shape itself and App Store Connect rejects icons
with transparency) and light/dark splash screens using the same staggered
Gantt-bar mark as the PWA icons.

Run with: .venv/Scripts/python scripts/generate_ios_assets.py
Then on the Mac, inside mobile/: npx @capacitor/assets generate --ios
Requires Pillow (pip install Pillow) -- a dev-only tool, not a runtime dependency.
"""

from pathlib import Path

from PIL import Image, ImageDraw

BASE_DIR = Path(__file__).resolve().parent.parent
RESOURCES_DIR = BASE_DIR / 'mobile' / 'resources'

BLUE = '#1F6091'
AMBER = '#E07B2C'
PAPER = '#EEF1F4'
INK_DARK_BG = '#10171E'

SUPERSAMPLE = 4


def draw_bars(draw, n, cx, cy, scale, bar_color, crit_color):
    """The three staggered Gantt bars, centered in a `scale`-sized square at (cx, cy)."""
    bar_h = round(scale * 0.16)
    gap = round(scale * 0.12)
    total_h = bar_h * 3 + gap * 2
    top = cy - total_h / 2
    left = cx - scale * 0.32

    bars = [
        (left, top, left + scale * 0.60, bar_color),
        (left + scale * 0.11, top + bar_h + gap, left + scale * 0.11 + scale * 0.68, bar_color),
        (left, top + (bar_h + gap) * 2, left + scale * 0.46, crit_color),
    ]
    radius = round(bar_h * 0.35)
    for x0, y0, x1, color in bars:
        draw.rounded_rectangle([x0, y0, x1, y0 + bar_h], radius=radius, fill=color)


def make_icon():
    """Flat, full-bleed 1024x1024 -- no corner rounding, no alpha channel."""
    n = 1024 * SUPERSAMPLE
    img = Image.new('RGB', (n, n), BLUE)
    draw = ImageDraw.Draw(img)
    draw_bars(draw, n, n / 2, n / 2, n, PAPER, AMBER)
    return img.resize((1024, 1024), Image.LANCZOS)


def make_splash(bg_color, bar_color, crit_color):
    n = 2732
    img = Image.new('RGB', (n, n), bg_color)
    draw = ImageDraw.Draw(img)
    draw_bars(draw, n, n / 2, n / 2, n * 0.32, bar_color, crit_color)
    return img


def main():
    RESOURCES_DIR.mkdir(parents=True, exist_ok=True)

    make_icon().save(RESOURCES_DIR / 'icon.png')
    make_splash(PAPER, BLUE, AMBER).save(RESOURCES_DIR / 'splash.png')
    make_splash(INK_DARK_BG, '#4F9BC9', '#E8944C').save(RESOURCES_DIR / 'splash-dark.png')

    for name in ('icon.png', 'splash.png', 'splash-dark.png'):
        print('wrote', RESOURCES_DIR / name)


if __name__ == '__main__':
    main()
