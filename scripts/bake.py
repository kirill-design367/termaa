#!/usr/bin/env python3
"""
Печёт ассеты TERMA из двух исходных кадров.

  1. Градуирует кадры в «тёплый средний» мир (см. CLAUDE.md → Цвет).
  2. Вырезает из фонового кадра слои пара и собирает из них
     три тира плотности + плашку под курсор.

Всё, что здесь размывается, размывается ОДИН РАЗ на сборке.
В рантайме ни один фильтр не анимируется.
"""
import os
import numpy as np
from PIL import Image, ImageFilter

SRC = os.path.join(os.path.dirname(__file__), "..", "assets-src")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "img")
os.makedirs(OUT, exist_ok=True)


# ─────────────────────────────────────────────────────────────── грейдинг ────
def grade(im: Image.Image, *, lift_shadows, warm, gain, gamma, sky_pull) -> Image.Image:
    """Тёплый средний мир: снимаем стерильную холодную белизну исходника."""
    a = np.asarray(im.convert("RGB"), dtype=np.float32) / 255.0

    # 1. Тонирование: холодный кадр уводим в тёплый камень.
    a = a ** gamma
    a = a * np.array(gain, dtype=np.float32)
    a = a + np.array(warm, dtype=np.float32)

    # 2. Подтягиваем тени, чтобы кадр не проваливался в чёрное.
    a = lift_shadows + a * (1.0 - lift_shadows)

    # 3. Гасим небо сверху — иначе шапка и белый текст в нём тонут.
    h = a.shape[0]
    ramp = np.linspace(1.0 - sky_pull, 1.0, h, dtype=np.float32) ** 1.6
    a *= ramp[:, None, None]

    # 4. Лёгкая десатурация в светах: пар должен остаться серо-белым.
    lum = (a * np.array([0.2126, 0.7152, 0.0722], np.float32)).sum(-1, keepdims=True)
    a = a + (lum - a) * np.clip((lum - 0.62) / 0.38, 0, 1) * 0.35

    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "RGB")


# ────────────────────────────────────────────────────────────────── пар ─────
def steam_alpha(im: Image.Image, box, *, floor, ceil, gamma) -> np.ndarray:
    """Альфа пара = нормированная светлота выбранной полосы кадра."""
    crop = im.convert("RGB").crop(box)
    lum = np.asarray(crop, np.float32) @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    lum /= 255.0
    a = np.clip((lum - floor) / (ceil - floor), 0, 1) ** gamma
    return a


def feather(a: np.ndarray, top=0.35, bottom=0.55, side=0.10) -> np.ndarray:
    h, w = a.shape
    vy = np.ones(h, np.float32)
    ty, by = max(1, int(h * top)), max(1, int(h * bottom))
    vy[:ty] *= np.linspace(0, 1, ty) ** 1.5
    vy[h - by:] *= np.linspace(1, 0, by) ** 1.2
    vx = np.ones(w, np.float32)
    sx = max(1, int(w * side))
    vx[:sx] *= np.linspace(0, 1, sx)
    vx[w - sx:] *= np.linspace(1, 0, sx)
    return a * vy[:, None] * vx[None, :]


def mirror_tile(a: np.ndarray, times: int) -> np.ndarray:
    out = [a if i % 2 == 0 else a[:, ::-1] for i in range(times)]
    return np.concatenate(out, axis=1)


def to_png(alpha: np.ndarray, tint, blur, path, size=None):
    h, w = alpha.shape
    rgb = np.zeros((h, w, 3), np.uint8)
    rgb[:, :] = tint
    img = Image.fromarray(
        np.dstack([rgb, (np.clip(alpha, 0, 1) * 255).astype(np.uint8)]), "RGBA"
    )
    if size:
        img = img.resize(size, Image.LANCZOS)
    if blur:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    img.save(path, optimize=True)
    return img


def stamp_field(desk, W, H, *, seed, n, scale_lo, scale_hi, opa_lo, opa_hi,
                y_bias, boxes) -> np.ndarray:
    """
    Собирает поле пара из множества случайно поставленных вырезок кадра.
    Зеркальная плитка даёт видимый повтор — здесь повтора нет: каждая
    вырезка своего размера, своей прозрачности и своего разворота.
    """
    rng = np.random.default_rng(seed)
    canvas = np.zeros((H, W), np.float32)
    patches = []
    for box, f, c, g in boxes:
        patches.append(steam_alpha(desk, box, floor=f, ceil=c, gamma=g))

    for _ in range(n):
        src = patches[rng.integers(len(patches))]
        sh, sw = src.shape
        k = rng.uniform(scale_lo, scale_hi)
        pw, ph = max(8, int(sw * k)), max(8, int(sh * k))
        p = np.asarray(
            Image.fromarray((np.clip(src, 0, 1) * 255).astype(np.uint8))
            .resize((pw, ph), Image.BILINEAR),
            np.float32) / 255.0
        if rng.random() < 0.5:
            p = p[:, ::-1]
        p = feather(p, top=0.45, bottom=0.45, side=0.30)
        p *= rng.uniform(opa_lo, opa_hi)

        x = int(rng.integers(-pw // 2, W - pw // 2))
        y = int(H * rng.beta(*y_bias)) - ph // 2
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(W, x + pw), min(H, y + ph)
        if x1 <= x0 or y1 <= y0:
            continue
        canvas[y0:y1, x0:x1] = 1.0 - (1.0 - canvas[y0:y1, x0:x1]) * \
            (1.0 - p[y0 - y:y1 - y, x0 - x:x1 - x])
    return canvas


def build_steam(desk: Image.Image):
    """Три тира плотности + вертикальный клуб для мобильной."""
    # Три места кадра, где пар читается как самостоятельная субстанция:
    # полоса над бассейном, молоко у горизонта, дымка в долине слева.
    boxes = [
        ((200, 660, 1100, 940), 0.52, 0.93, 1.15),
        ((900, 690, 1900, 910), 0.60, 0.98, 0.80),
        ((0, 700, 700, 980), 0.48, 0.90, 1.30),
    ]
    W, H = 2400, 620
    tint_cold = (231, 235, 238)
    tint_warm = (241, 236, 227)

    # Тир 1 — редкая дымка. Лежит ниже всех, не гаснет никогда.
    t1 = stamp_field(desk, W, H, seed=11, n=52, scale_lo=0.55, scale_hi=1.55,
                     opa_lo=0.10, opa_hi=0.30, y_bias=(2.2, 1.5), boxes=boxes)
    # Тир 2 — средняя плотность.
    t2 = stamp_field(desk, W, H, seed=1800, n=74, scale_lo=0.40, scale_hi=1.20,
                     opa_lo=0.20, opa_hi=0.50, y_bias=(2.6, 1.35), boxes=boxes)
    # Тир 3 — плотное молоко. Именно оно расходится под курсором.
    t3 = stamp_field(desk, W, H, seed=90, n=96, scale_lo=0.30, scale_hi=1.00,
                     opa_lo=0.28, opa_hi=0.66, y_bias=(3.0, 1.2), boxes=boxes)

    # Плотность растёт книзу — пар лежит на воде, а не висит в небе.
    # Показатель степени держит верх полосы почти прозрачным: иначе
    # дымка ползёт к горизонту и съедает глубину кадра.
    ramp = np.linspace(0.0, 1.0, H, np.float32) ** 1.5
    # Края гасим совсем чуть-чуть: слово должно уходить в пар по всей ширине,
    # а не только в середине кадра.
    edge = np.ones(W, np.float32)
    e = int(W * 0.02)
    edge[:e] *= np.linspace(0.4, 1, e)
    edge[W - e:] *= np.linspace(1, 0.4, e)

    # Верхняя пятая часть полосы почти прозрачна — режем её.
    # Кадр от этого не меняется, а маскируемая площадь падает на пятую
    # часть: маска — единственная операция, которую браузер считает
    # по площади каждый кадр.
    cut = int(H * 0.20)
    for name, field, mul, tint, blur in (
        ("steam-1", t1, 0.92, tint_cold, 7),
        ("steam-2", t2, 1.00, tint_warm, 5),
        ("steam-3", t3, 1.12, tint_warm, 4),
    ):
        a = np.clip(field * ramp[:, None] * edge[None, :] * mul, 0, 1)[cut:]
        to_png(a, tint, blur, f"{OUT}/{name}.png")

    del tint_cold


def droplets(w, h, *, seed, n, r_lo, r_hi, a_lo, a_hi) -> np.ndarray:
    """
    Поле капель. Конденсат — это множество мелких линз, а не большие
    пятна: крупный шум читается как камуфляж, а не как запотевшее стекло.
    """
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w), np.float32)
    xs = rng.integers(0, w, n)
    ys = rng.integers(0, h, n)
    rs = rng.uniform(r_lo, r_hi, n)
    al = rng.uniform(a_lo, a_hi, n)
    for x, y, r, v in zip(xs, ys, rs, al):
        ri = int(np.ceil(r))
        x0, x1 = max(0, x - ri), min(w, x + ri + 1)
        y0, y1 = max(0, y - ri), min(h, y + ri + 1)
        if x1 <= x0 or y1 <= y0:
            continue
        gy, gx = np.mgrid[y0:y1, x0:x1]
        d = np.sqrt((gx - x) ** 2 + (gy - y) ** 2) / r
        blob = np.clip(1.0 - d, 0, 1) ** 1.6 * v
        a[y0:y1, x0:x1] = 1.0 - (1.0 - a[y0:y1, x0:x1]) * (1.0 - blob)
    return a


def edge_weight(w, h, *, hold, power) -> np.ndarray:
    """Единица по краям кадра, ноль в середине."""
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.maximum(np.abs(xx / w - 0.5) * 2, np.abs(yy / h - 0.5) * 2)
    return np.clip((r - hold) / (1.0 - hold), 0, 1) ** power


def build_condensation():
    """Конденсат: мелкая капля по краям кадра — и матовая наледь для ответов."""
    w, h = 1280, 720

    fine = droplets(w, h, seed=1800, n=2100, r_lo=2.4, r_hi=7.5, a_lo=0.12, a_hi=0.36)
    big = droplets(w, h, seed=90, n=230, r_lo=9.0, r_hi=22.0, a_lo=0.09, a_hi=0.24)
    field = 1.0 - (1.0 - fine) * (1.0 - big)

    # Запотевает по краям, середина кадра остаётся чистой.
    to_png(np.clip(field * edge_weight(w, h, hold=0.34, power=1.1) * 1.75, 0, 1),
           (238, 242, 243), 1.2, f"{OUT}/fog.png")

    # Матовая наледь: ею закрыт ответ в блоке «Вопросы», пока он не раскрыт.
    veil = droplets(720, 260, seed=44, n=5200, r_lo=1.4, r_hi=5.0, a_lo=0.22, a_hi=0.5)
    veil = 1.0 - (1.0 - veil) * (1.0 - 0.80)   # плотная подложка
    to_png(np.clip(veil, 0, 1), (235, 230, 220), 1.4, f"{OUT}/frost.png")


def main():
    desk = Image.open(f"{SRC}/terma-desktop.jpg")
    mob = Image.open(f"{SRC}/terma-mobile.jpg")
    print("исходники:", desk.size, mob.size)

    gd = grade(desk, lift_shadows=0.045, warm=(0.030, 0.008, -0.030),
               gain=(1.00, 0.955, 0.885), gamma=1.34, sky_pull=0.30)
    gm = grade(mob, lift_shadows=0.045, warm=(0.030, 0.008, -0.030),
               gain=(1.00, 0.955, 0.885), gamma=1.30, sky_pull=0.34)

    gd.save(f"{OUT}/hero-desktop.png")
    gm.save(f"{OUT}/hero-mobile.png")

    build_steam(desk)
    build_condensation()
    print("готово →", OUT)


if __name__ == "__main__":
    main()
