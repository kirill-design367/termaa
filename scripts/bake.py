#!/usr/bin/env python3
"""
Печёт ассеты TERMA из двух исходных кадров.

  1. Градуирует кадр героя и вырезает область бассейна полигоном.
  2. Печёт конденсат для наведения и матовую наледь для ответов.

Пар отсюда убран вместе с приёмом: слоёв поверх фотографии в кадре
героя нет ни одного, а воду рисует шейдер по маске из этого же файла.

Всё, что здесь размывается, размывается ОДИН РАЗ на сборке.
В рантайме ни один фильтр не анимируется.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = os.path.join(os.path.dirname(__file__), "..", "assets-src")
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "img")
os.makedirs(OUT, exist_ok=True)


# ─────────────────────────────────────────────────────────────── грейдинг ────
def grade(im: Image.Image, *, lift_shadows, warm, gain, gamma, sky_pull, sky_lift=0.0) -> Image.Image:
    """Тёплый средний мир: снимаем стерильную холодную белизну исходника."""
    a = np.asarray(im.convert("RGB"), dtype=np.float32) / 255.0

    # 1. Тонирование: холодный кадр уводим в тёплый камень.
    a = a ** gamma
    a = a * np.array(gain, dtype=np.float32)
    a = a + np.array(warm, dtype=np.float32)

    # 2. Подтягиваем тени, чтобы кадр не проваливался в чёрное.
    a = lift_shadows + a * (1.0 - lift_shadows)

    # 3. Небо и горы сверху раскрываем. Гамма меньше единицы поднимает
    #    полутона и при этом физически не может выбить света в белое —
    #    множитель бы выбил. Верх кадра становится ясным, а не глухим.
    h = a.shape[0]
    if sky_pull:
        ramp = np.linspace(1.0 - sky_pull, 1.0, h, dtype=np.float32) ** 1.6
        a *= ramp[:, None, None]
    if sky_lift:
        # Подъём приходится на горы и середину кадра, а не на самую
        # верхнюю кромку. Иначе небо за навигацией выбивается в белое, и
        # белый текст на нём не держит 4.5:1 ни при какой тени.
        # Кривая обязана сходить в ноль на ОБЕИХ кромках кадра. Первая
        # версия обнулялась на 0.78 высоты и ниже не действовала — это
        # давало ровную тональную ступень поперёк кадра, то есть шов.
        t = np.linspace(0.0, 1.0, h, dtype=np.float32)
        # Синус на правом конце уходит в −8.7e-08 из-за округления, а
        # отрицательное в дробной степени даёт NaN — и последняя строка
        # кадра приезжала чёрной чертой во всю ширину. Обрезаем в ноль.
        bump = np.clip(np.sin(np.pi * t), 0.0, None) ** 0.6
        gam = 1.0 - sky_lift * bump
        a = np.clip(a, 0.0, 1.0) ** gam[:, None, None]

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


def build_pool_mask(size, poly, name: str):
    """
    Маска области бассейна.

    Область задана полигоном в долях кадра и растушёвана: снимать её со
    светлоты нельзя — после осветления вода стала светлее переплётов
    павильона, и порог по яркости выбирал именно переплёты.
    """
    w, h = size
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).polygon([(x * w, y * h) for x, y in poly], fill=255)
    a = np.asarray(m, np.float32) / 255.0
    to_png(a, (255, 255, 255), max(w, h) * 0.012, f"{OUT}/{name}.png")


def build_drip():
    """
    Потёк для наведения: капля идёт по запотевшему стеклу сверху вниз
    неровной дорожкой. Слой готовится здесь, в рантайме он только едет
    трансформом — ни одного анимируемого фильтра.

    Геометрия привязана к тому, как слой едет. Он втрое выше кнопки и
    сдвигается с −66% до 0%, поэтому в окно кнопки по очереди попадает
    полоса плитки — снизу вверх по самой плитке. Значит голова капли
    лежит примерно на 0.66 высоты (в первом кадре она у верхней кромки
    кнопки), а хвост тянется выше неё, до 0.33. Всё остальное пусто:
    к концу 0.6 с след затягивается сам, без отдельной анимации.
    """
    w, h = 96, 512
    rng = np.random.default_rng(7)
    a = np.zeros((h, w), np.float32)
    f = np.arange(h) / (h - 1)

    HEAD, TAIL = 0.665, 0.30
    # Дорожка одна, рядом вторая — тоньше и с отставанием: край рваный,
    # но это по-прежнему одна капля, а не гребёнка.
    for cx, wid, amp, freq, alpha, lag in (
        (0.46, 11.0, 9.0, 2.4, 1.00, 0.00),
        (0.62, 5.0, 12.0, 3.3, 0.50, 0.07),
    ):
        wobble = (np.sin(f * freq * 2 * np.pi + rng.uniform(0, 6)) * amp
                  + np.sin(f * freq * 5.3 * np.pi) * amp * 0.35)
        path = cx * w + wobble
        # Ширина дорожки гуляет — капля то разгоняется, то тормозит.
        wcur = wid * (0.7 + 0.3 * np.sin(f * 9.0 + rng.uniform(0, 6)))
        d = np.abs(np.arange(w)[None, :] - path[:, None]) / wcur[:, None]
        streak = np.clip(1.0 - d, 0, 1) ** 1.5 * alpha

        head, tail = HEAD - lag, TAIL - lag
        # Голова — короткий яркий сгусток, хвост тянется вверх и тает.
        blob = np.exp(-(((f - head) / 0.055) ** 2))
        trail = np.clip((f - tail) / (head - tail), 0, 1) ** 1.7
        trail *= np.clip((head + 0.02 - f) / 0.05, 0, 1)
        prof = np.clip(trail * 0.72 + blob, 0, 1)
        a = 1.0 - (1.0 - a) * (1.0 - streak * prof[:, None])

    to_png(np.clip(a, 0, 1), (250, 250, 248), 1.2, f"{OUT}/drip.png")


def main():
    desk = Image.open(f"{SRC}/terma-desktop.jpg")
    mob = Image.open(f"{SRC}/terma-mobile.jpg")
    print("исходники:", desk.size, mob.size)

    # Экспозиция поднята: gamma почти линейная, усиление выше, притенение
    # неба снято. Горы и павильон обязаны читаться отчётливо, серой
    # пелены в кадре нет.
    #
    # Подъём полутонов при этом ослаблен втрое. Он ставился под белый
    # текст поверх кадра — чтобы небо не выбивалось и белое на нём
    # держалось. Текста поверх кадра больше нет: чернила тёмные, запас
    # по контрасту двадцатикратный, — а подъём платил за это плоскими
    # горами. Возвращаем горам глубину.
    gd = grade(desk, lift_shadows=0.022, warm=(0.026, 0.007, -0.026),
               gain=(1.045, 1.005, 0.940), gamma=1.03, sky_pull=0.0, sky_lift=0.12)
    gm = grade(mob, lift_shadows=0.022, warm=(0.026, 0.007, -0.026),
               gain=(1.045, 1.005, 0.940), gamma=1.01, sky_pull=0.0, sky_lift=0.12)

    gd.save(f"{OUT}/hero-desktop.png")
    gm.save(f"{OUT}/hero-mobile.png")

    build_condensation()
    build_drip()
    # Полигоны сняты по сетке с самих кадров, см. отчёт.
    build_pool_mask(desk.size,
                    [(0.0, 0.572), (0.60, 0.572), (0.665, 0.70),
                     (0.685, 0.795), (0.0, 0.805)], "pool-desktop")
    build_pool_mask(mob.size,
                    [(0.0, 0.60), (0.40, 0.575), (0.72, 0.60),
                     (0.86, 1.0), (0.0, 1.0)], "pool-mobile")
    print("готово →", OUT)


if __name__ == "__main__":
    main()
