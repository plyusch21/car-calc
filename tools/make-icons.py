#!/usr/bin/env python3
"""Генерирует icons/*.png для PWA-манифеста (ТЗ 16) из logo-kp.png.

Холст 1024x1024, фон — тот же градиент, что у .kp-hero (index.html ~405):
160deg, #0d1626 0% -> #12306a 70% -> #1a4db5 100%. Логотип по центру,
ширина 70% холста (помещается в безопасный круг Android maskable,
радиус 40% от центра) — одна картинка годится и как обычная иконка,
и как maskable. Без прозрачности (iOS заливает её чёрным), без скруглённых
углов (iOS/Android скругляют сами). Перезапускать после замены logo-kp.png
или дизайнерского оригинала под именем icon-512.png и т.д.
"""
import math
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANVAS = 1024
LOGO_WIDTH_RATIO = 0.70

GRADIENT_STOPS = [
    (0.0, (0x0d, 0x16, 0x26)),
    (0.7, (0x12, 0x30, 0x6a)),
    (1.0, (0x1a, 0x4d, 0xb5)),
]
ANGLE_DEG = 160


def lerp(a, b, t):
    return a + (b - a) * t


def gradient_color(t):
    t = min(max(t, 0.0), 1.0)
    for (t0, c0), (t1, c1) in zip(GRADIENT_STOPS, GRADIENT_STOPS[1:]):
        if t0 <= t <= t1:
            local_t = (t - t0) / (t1 - t0) if t1 > t0 else 0
            return tuple(int(round(lerp(c0[i], c1[i], local_t))) for i in range(3))
    return GRADIENT_STOPS[-1][1]


def make_background(size):
    """CSS linear-gradient(160deg, ...) — 0deg = снизу вверх, по часовой стрелке."""
    img = Image.new('RGB', (size, size))
    px = img.load()
    theta = math.radians(ANGLE_DEG)
    dx, dy = math.sin(theta), -math.cos(theta)
    coords = [(x, y) for y in range(size) for x in range(size)]
    projections = [x * dx + y * dy for x, y in coords]
    pmin, pmax = min(projections), max(projections)
    span = (pmax - pmin) or 1
    idx = 0
    for y in range(size):
        for x in range(size):
            t = (projections[idx] - pmin) / span
            px[x, y] = gradient_color(t)
            idx += 1
    return img


def build_master():
    bg = make_background(CANVAS)

    logo = Image.open(os.path.join(ROOT, 'logo-kp.png')).convert('RGBA')
    target_w = int(round(CANVAS * LOGO_WIDTH_RATIO))
    target_h = int(round(logo.height * target_w / logo.width))
    logo = logo.resize((target_w, target_h), Image.LANCZOS)

    master = bg.convert('RGBA')
    pos = ((CANVAS - target_w) // 2, (CANVAS - target_h) // 2)
    master.alpha_composite(logo, pos)
    return master.convert('RGB')


def main():
    master = build_master()
    out_dir = os.path.join(ROOT, 'icons')
    os.makedirs(out_dir, exist_ok=True)

    sizes = [
        ('icon-512.png', 512),
        ('icon-192.png', 192),
        ('apple-touch-icon.png', 180),
        ('favicon-32.png', 32),
    ]
    for name, size in sizes:
        resized = master.resize((size, size), Image.LANCZOS)
        resized.save(os.path.join(out_dir, name))
        print('wrote', os.path.join('icons', name), resized.size)


if __name__ == '__main__':
    main()
