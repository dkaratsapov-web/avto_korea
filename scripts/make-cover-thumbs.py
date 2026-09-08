#!/usr/bin/env python3
"""Маленькие превью обложек статей.

В списке статей и в блоке «читайте также» картинка занимает узкий слот
примерно 148×83 CSS-пикселя. Отдавать туда исходные обложки 1800 px —
это лишний мегабайт трафика на страницу списка ради восьми миниатюр,
поэтому кладём рядом уменьшенные копии.

Пропорции те же, что у оригинала (16:9), и кадрирования нет намеренно:
обложки — это текстовые баннеры с названием статьи, любой обрез режет
слова пополам.

Запуск: python3 scripts/make-cover-thumbs.py
Результат: public/covers/thumbs/<имя>.jpg — 480×270 (запас на 2× экран).
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "covers"
OUT = SRC / "thumbs"
SIZE = (480, 270)

OUT.mkdir(parents=True, exist_ok=True)

for path in sorted(SRC.glob("*.jpg")):
    # Внутренние иллюстрации статей в списке не показываются — миниатюры
    # нужны только обложкам.
    if path.stem.endswith("-inner"):
        continue

    with Image.open(path) as im:
        thumb = im.convert("RGB").resize(SIZE, Image.LANCZOS)
        thumb.save(OUT / path.name, quality=82, optimize=True, progressive=True)
        print(f"{path.name}: {im.size} → {SIZE}")
