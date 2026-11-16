#!/usr/bin/env python3
"""
Собрать PDF из нашего markdown — чтобы документ можно было отправить клиенту.

Зачем свой сборщик. Готовые конвертеры markdown → PDF в этой среде либо
недоступны, либо выдают документ шрифтом по умолчанию: у базовых шрифтов
PDF нет кириллицы, и текст превращается в чёрные квадраты. Поэтому шрифт
подключаем явно (Manrope — тот же, что на сайте), а разметку разбираем сами:
её набор у нас небольшой и предсказуемый — заголовки, абзацы, списки,
таблицы и разделители.

Запуск: python3 scripts/md-to-pdf.py docs/файл.md docs/файл.pdf
Шрифты берутся из каталога, указанного в FONT_DIR (по умолчанию — рядом,
в .fonts), а если их там нет — скачиваются с Google Fonts один раз.
"""

import os
import re
import sys
import urllib.request

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# Фирменные цвета сайта — документ должен выглядеть своим.
GRAPHITE = colors.HexColor("#11151A")
BORDEAUX = colors.HexColor("#7A1410")
BRIGHT = colors.HexColor("#9C1A12")
INK = colors.HexColor("#171A1E")
INK2 = colors.HexColor("#5B6470")
LINE = colors.HexColor("#E6E8EC")
ZEBRA = colors.HexColor("#F7F8FA")

FONT_DIR = os.environ.get(
    "FONT_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), ".fonts")
)
FONT_URLS = {
    400: "https://fonts.gstatic.com/s/manrope/v20/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk79FO_F.ttf",
    600: "https://fonts.gstatic.com/s/manrope/v20/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk4jE-_F.ttf",
    800: "https://fonts.gstatic.com/s/manrope/v20/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk59E-_F.ttf",
}


def register_fonts():
    """Подключить Manrope. Без кириллического шрифта документ нечитаем."""
    os.makedirs(FONT_DIR, exist_ok=True)
    for weight, url in FONT_URLS.items():
        path = os.path.join(FONT_DIR, f"Manrope-{weight}.ttf")
        if not os.path.exists(path):
            urllib.request.urlretrieve(url, path)
        pdfmetrics.registerFont(TTFont(f"Manrope-{weight}", path))
    pdfmetrics.registerFontFamily(
        "Manrope-400", normal="Manrope-400", bold="Manrope-800", italic="Manrope-400"
    )
    # Моноширинный нужен только для путей и названий полей — берём системный.
    mono = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
    if os.path.exists(mono):
        pdfmetrics.registerFont(TTFont("Mono", mono))
        return "Mono"
    return "Manrope-400"


MONO = None

# ------------------------------------------------------------------ разметка


# Эмодзи. В Manrope их нет — без подмены вместо 👇 в PDF чёрный квадрат.
# Рисуем каждый эмодзи цветным шрифтом Noto в картинку и вставляем в строку.
EMOJI_FONT = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
EMOJI_RE = re.compile(
    "[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF\u23E9-\u23FA]\uFE0F?"
)


def emoji_img(ch):
    """Картинка эмодзи из кеша рядом со шрифтами; None — если нарисовать нечем."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return None
    if not os.path.exists(EMOJI_FONT):
        return None
    path = os.path.join(FONT_DIR, "emoji", "-".join(f"{ord(c):x}" for c in ch) + ".png")
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        font = ImageFont.truetype(EMOJI_FONT, 109)  # у цветного Noto единственный размер
        im = Image.new("RGBA", (136, 128), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((0, 0), ch, font=font, embedded_color=True)
        im.crop(im.getbbox() or (0, 0, 128, 128)).save(path)
    return path


def emoji(text):
    def sub(m):
        path = emoji_img(m.group(0))
        return f'<img src="{path}" width="10" height="10" valign="-1.5"/>' if path else ""

    return EMOJI_RE.sub(sub, text)


def inline(text):
    """Жирное, моноширинное, ссылки и эмодзи — в разметку reportlab."""
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = emoji(text)
    # «1 780 000 ₽» не разрываем: пробелы в разрядах и перед ₽ — неразрывные.
    text = re.sub(r"(?<=\d) (?=\d{3}\b|₽)", "\u00a0", text)
    text = re.sub(r"\*\*(.+?)\*\*", r'<font name="Manrope-800">\1</font>', text)
    text = re.sub(
        r"`(.+?)`",
        lambda m: f'<font name="{MONO}" size="8.2" color="#7A1410">{m.group(1)}</font>',
        text,
    )
    return text


def split_row(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def parse(md):
    """Markdown → список блоков. Разбираем ровно то, что сами и пишем."""
    lines = md.split("\n")
    blocks = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        if stripped.startswith("#"):
            level = len(stripped) - len(stripped.lstrip("#"))
            blocks.append(("h", level, stripped[level:].strip()))
            i += 1
            continue

        if re.fullmatch(r"-{3,}", stripped):
            blocks.append(("hr",))
            i += 1
            continue

        # Таблица: строка с «|», под ней строка-разделитель.
        if stripped.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s:|-]+\|$", lines[i + 1].strip()):
            header = split_row(stripped)
            align = [
                "RIGHT" if c.strip().endswith(":") else "LEFT"
                for c in split_row(lines[i + 1].strip())
            ]
            rows = []
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(split_row(lines[i].strip()))
                i += 1
            blocks.append(("table", header, align, rows))
            continue

        # Списки: продолжения пунктов идут с отступом.
        m = re.match(r"^(\d+)\.\s+(.*)$", stripped) or re.match(r"^[-*]\s+(.*)$", stripped)
        if m:
            ordered = bool(re.match(r"^\d+\.", stripped))
            items = []
            while i < len(lines):
                cur = lines[i]
                s = cur.strip()
                if not s:
                    # Пустая строка заканчивает список, если дальше не отступ.
                    nxt = lines[i + 1] if i + 1 < len(lines) else ""
                    if not re.match(r"^\s{2,}\S", nxt):
                        break
                    i += 1
                    continue
                mm_ = re.match(r"^(\d+)\.\s+(.*)$", s) if ordered else re.match(r"^[-*]\s+(.*)$", s)
                if mm_:
                    items.append(
                        (mm_.group(1) + "." if ordered else "•", mm_.group(2) if ordered else mm_.group(1))
                    )
                elif re.match(r"^\s{2,}\S", cur) and items:
                    items[-1] = (items[-1][0], items[-1][1] + " " + s)
                else:
                    break
                i += 1
            blocks.append(("list", items))
            continue

        # Абзац: до пустой строки.
        para = []
        while i < len(lines) and lines[i].strip() and not lines[i].strip().startswith(("#", "|", "- ", "---")):
            para.append(lines[i].strip())
            i += 1
        if para:
            blocks.append(("p", " ".join(para)))
    return blocks


# ------------------------------------------------------------------- вёрстка

PAGE_W, PAGE_H = A4
MARGIN = 17 * mm
CONTENT_W = PAGE_W - 2 * MARGIN


def styles():
    body = ParagraphStyle(
        "body",
        fontName="Manrope-400",
        fontSize=9.6,
        leading=14.6,
        textColor=INK,
        alignment=TA_LEFT,
        spaceAfter=0,
    )
    return {
        "body": body,
        "h1": ParagraphStyle("h1", parent=body, fontName="Manrope-800", fontSize=21, leading=25, textColor=GRAPHITE),
        # keepWithNext, а не склейка блоков вручную: заголовок не должен
        # остаться внизу страницы один, но и тащить за собой на новую страницу
        # всю таблицу он не должен — она умеет разрываться сама.
        "h2": ParagraphStyle("h2", parent=body, fontName="Manrope-800", fontSize=13.5, leading=17,
                             textColor=BORDEAUX, spaceBefore=12, spaceAfter=7, keepWithNext=1),
        "h3": ParagraphStyle("h3", parent=body, fontName="Manrope-800", fontSize=10.6, leading=14,
                             textColor=GRAPHITE, spaceBefore=9, spaceAfter=4, keepWithNext=1),
        "lead": ParagraphStyle("lead", parent=body, fontSize=9.2, leading=13.6, textColor=INK2),
        "th": ParagraphStyle("th", parent=body, fontName="Manrope-800", fontSize=8.3, leading=10.6, textColor=colors.white),
        "td": ParagraphStyle("td", parent=body, fontSize=8.6, leading=11.4),
        "tdr": ParagraphStyle("tdr", parent=body, fontSize=8.6, leading=11.4, alignment=2),
        "li": ParagraphStyle("li", parent=body, fontSize=9.6, leading=14.2),
        "marker": ParagraphStyle("marker", parent=body, fontName="Manrope-800", fontSize=9.6, leading=14.2, textColor=BRIGHT),
    }


def column_widths(header, rows):
    """
    Ширины колонок: сначала неразрывное, потом остальное.

    Делить ширину пропорционально длине содержимого нельзя. Колонка с
    названием кампании длиннее всех и забирает почти всё, а узкой числовой
    достаётся меньше, чем занимает её же заголовок, — и «Визиты» переносится
    по слогам, а «2104» разрывается пополам. Поэтому каждой колонке сначала
    отдаём ширину самого длинного слова в ней (слово перенести нельзя), и
    только остаток делим по объёму текста.
    """
    n = len(header)
    plain = lambda s: re.sub(r"[*`]", "", s)
    floors, weights = [], []
    for c in range(n):
        cells = [header[c]] + [r[c] for r in rows if len(r) > c]
        widest_word = 0.0
        for i, cell in enumerate(cells):
            font, size = ("Manrope-800", 8.3) if i == 0 else ("Manrope-400", 8.6)
            for word in plain(cell).split():
                widest_word = max(widest_word, pdfmetrics.stringWidth(word, font, size))
        floors.append(widest_word + 13)
        weights.append(sum(len(plain(x)) for x in cells) / max(len(cells), 1))

    slack = CONTENT_W - sum(floors)
    if slack <= 0:
        # Даже неразрывное не влезает — ужимаем пропорционально, перенос
        # внутри слова всё равно случится, но таблица останется в полосе.
        k = CONTENT_W / sum(floors)
        return [f * k for f in floors]
    total = sum(weights) or 1
    return [f + slack * w / total for f, w in zip(floors, weights)]


def build(md_path, pdf_path):
    global MONO
    MONO = register_fonts()
    st = styles()
    md = open(md_path, encoding="utf-8").read()
    blocks = parse(md)

    title = next((b[2] for b in blocks if b[0] == "h" and b[1] == 1), "Документ")
    story = []

    for b in blocks:
        kind = b[0]

        if kind == "h":
            level, text = b[1], b[2]
            if level == 1:
                story += [Paragraph(inline(text), st["h1"]), Spacer(1, 4)]
                story += [HRFlowable(width="100%", thickness=2, color=BORDEAUX, spaceAfter=10)]
            elif level == 2:
                story.append(Paragraph(inline(text), st["h2"]))
            else:
                story.append(Paragraph(inline(text), st["h3"]))

        elif kind == "hr":
            story += [Spacer(1, 6), HRFlowable(width="100%", thickness=0.6, color=LINE), Spacer(1, 2)]

        elif kind == "p":
            story += [Paragraph(inline(b[1]), st["body"]), Spacer(1, 7)]

        elif kind == "list":
            rows = [
                [Paragraph(marker, st["marker"]), Paragraph(inline(text), st["li"])]
                for marker, text in b[1]
            ]
            # Ширина под самый длинный маркер: на узкой колонке «10.»
            # переносится точкой на вторую строку.
            mw = max(
                pdfmetrics.stringWidth(marker, "Manrope-800", 9.6) for marker, _ in b[1]
            ) + 7
            t = Table(rows, colWidths=[mw, CONTENT_W - mw])
            t.setStyle(
                TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                    ]
                )
            )
            story += [t, Spacer(1, 8)]

        elif kind == "table":
            header, align, rows = b[1], b[2], b[3]
            data = [[Paragraph(inline(c), st["th"]) for c in header]]
            for r in rows:
                r = r + [""] * (len(header) - len(r))
                data.append(
                    [
                        Paragraph(inline(c), st["tdr"] if align[i] == "RIGHT" else st["td"])
                        for i, c in enumerate(r[: len(header)])
                    ]
                )
            t = Table(data, colWidths=column_widths(header, rows), repeatRows=1)
            style = [
                ("BACKGROUND", (0, 0), (-1, 0), GRAPHITE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("LINEBELOW", (0, 1), (-1, -1), 0.5, LINE),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
            ]
            for i in range(1, len(data)):
                if i % 2 == 0:
                    style.append(("BACKGROUND", (0, i), (-1, i), ZEBRA))
            t.setStyle(TableStyle(style))
            story += [t, Spacer(1, 10)]

    def decorate(canvas, doc):
        canvas.saveState()
        canvas.setFont("Manrope-400", 7.4)
        canvas.setFillColor(INK2)
        canvas.drawString(MARGIN, 11 * mm, title)
        canvas.drawRightString(PAGE_W - MARGIN, 11 * mm, str(doc.page))
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN, 14 * mm, PAGE_W - MARGIN, 14 * mm)
        canvas.restoreState()

    doc = BaseDocTemplate(
        pdf_path,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=20 * mm,
        title=title,
        author="ДиАвто69",
    )
    frame = Frame(MARGIN, 20 * mm, CONTENT_W, PAGE_H - MARGIN - 20 * mm, id="main")
    doc.addPageTemplates([PageTemplate(id="page", frames=[frame], onPage=decorate)])
    doc.build(story)
    print(f"{pdf_path}: {os.path.getsize(pdf_path)} Б")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Запуск: md-to-pdf.py вход.md выход.pdf")
    build(sys.argv[1], sys.argv[2])
