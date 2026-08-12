#!/usr/bin/env python3
"""
Готовит шрифты: сабсет под кириллицу + woff2 + метрики.

Метрики нужны не для красоты. Вордмарк TERMA обрезается нижней кромкой
вьюпорта ровно на треть высоты литеры — чтобы посадить его точно, надо
знать capHeight и положение базовой линии конкретной гарнитуры, а не
подгонять magic-number на глаз.
"""
import json
import os
import subprocess
import sys

from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ.get("TERMA_TTF", "/workspace/fontlab/ttf")
# Лицензионные исходники живут отдельно и в репозиторий не попадают:
# публичный репозиторий — не место для полного TTF купленной гарнитуры.
# В выдачу уходит только сабсет woff2, он и закоммичен.
LICENSED = os.path.join(HERE, "..", "assets-src", "fonts")
OUT = os.path.join(HERE, "..", "public", "fonts")
DATA = os.path.join(HERE, "..", "src", "lib", "fonts.generated.json")

# Кириллица целиком + латиница (только для имени бренда и техстрок) +
# цифры, пунктуация, ₽, °, №, —, тире, кавычки-ёлочки.
UNICODES = (
    "U+0020-007E,U+00A0,U+00B0,U+00AB,U+00BB,U+2010-2015,U+2018-201F,"
    "U+2026,U+2116,U+20BD,U+0400-045F,U+0490-0491,U+2212,U+00D7"
)

# Forum, Prata и Tenor Sans выведены из проекта: арт-директор забраковал их
# как самые заезженные «премиальные» гарнитуры русского веба.
# До выбора новой пары Golos Text работает и текстом, и акциденцией —
# в тяжёлом весе он держит крупный кегль честнее любой антиквы с Тильды.
FAMILIES = [
    # id, файл, семейство CSS, роль, вес/оси
    ("kudryashev", "KudryashevDisplay.ttf", "Kudryashev Display", "display", None),
    ("golos",     "GolosText_wght.ttf",    "Golos Text", "text",    (400, 900)),
    ("unbounded", "Unbounded_wght.ttf",    "Unbounded",  "display", (200, 900)),
    ("geologica", "Geologica_CRSV_SHRP_slnt_wght.ttf", "Geologica", "display", (100, 900)),
    ("onest",     "Onest_wght.ttf",        "Onest",      "text",    (100, 900)),
    ("manrope",   "Manrope_wght.ttf",      "Manrope",    "text",    (200, 800)),
    ("podkova",   "Podkova_wght.ttf",      "Podkova",    "display", (400, 800)),
]


def metrics(path):
    f = TTFont(path, lazy=True)
    upm = f["head"].unitsPerEm
    os2 = f["OS/2"]
    hhea = f["hhea"]
    cap = getattr(os2, "sCapHeight", None) or int(upm * 0.7)
    asc, desc = hhea.ascender, hhea.descender
    # Ширины литер T E R M A при весе по умолчанию — для проверки, что
    # слово вообще собирается в очень широком наборе без наездов.
    hmtx = f["hmtx"]
    cmap = f.getBestCmap()
    adv = {}
    for ch in "TERMA":
        gn = cmap.get(ord(ch))
        if gn:
            adv[ch] = round(hmtx[gn][0] / upm, 4)
    f.close()
    return dict(
        upm=upm,
        capR=round(cap / upm, 4),
        ascR=round(asc / upm, 4),
        descR=round(desc / upm, 4),
        adv=adv,
    )


def main():
    os.makedirs(OUT, exist_ok=True)
    out = {}
    for fid, fname, family, role, axes in FAMILIES:
        src = os.path.join(SRC, fname)
        if not os.path.exists(src):
            src = os.path.join(LICENSED, fname)
        if not os.path.exists(src):
            # Лицензионного исходника нет — оставляем уже собранный сабсет.
            dst = os.path.join(OUT, f"{fid}.woff2")
            if os.path.exists(dst) and os.path.exists(DATA):
                prev = json.load(open(DATA, encoding="utf-8"))
                if fid in prev:
                    out[fid] = prev[fid]
                    print(f"{fid:10} исходника нет — оставлен готовый сабсет")
                    continue
            sys.exit(f"нет исходника: {fname}")
        dst = os.path.join(OUT, f"{fid}.woff2")
        cmd = [
            sys.executable, "-m", "fontTools.subset", src,
            f"--unicodes={UNICODES}",
            "--layout-features=kern,liga,calt,locl,onum,tnum,case",
            "--flavor=woff2",
            "--desubroutinize",
            f"--output-file={dst}",
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        m = metrics(src)
        out[fid] = dict(
            id=fid, family=family, role=role, file=f"{fid}.woff2",
            variable=bool(axes), wght=list(axes) if axes else [400],
            bytes=os.path.getsize(dst), **m,
        )
        print(f"{fid:10} {family:12} {out[fid]['bytes']:>7} B  cap={m['capR']}")

    with open(DATA, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    print("метрики →", DATA)


if __name__ == "__main__":
    main()
