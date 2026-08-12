/**
 * Геометрия воды в кадре героя.
 *
 * Область бассейна снята полигоном по самому кадру — по сетке, наложенной
 * на исходник. Снимать её со светлоты нельзя: после градуировки вода
 * светлее переплётов павильона, и порог по яркости выбирает переплёты.
 *
 * Полигоны те же, что печёт `scripts/bake.py` в маску: один источник на
 * два потребителя — испечённая маска для шейдера и эти же числа для
 * попадания курсора. Расходиться они не могут по построению.
 */

/** Доли КАДРА ФОТОГРАФИИ, а не экрана. Экран получается наложением. */
export const POOL_DESKTOP: [number, number][] = [
  [0.0, 0.572],
  [0.6, 0.572],
  [0.665, 0.7],
  [0.685, 0.795],
  [0.0, 0.805],
]

export const POOL_MOBILE: [number, number][] = [
  [0.0, 0.6],
  [0.4, 0.575],
  [0.72, 0.6],
  [0.86, 1.0],
  [0.0, 1.0],
]

/** Линия воды — верхняя кромка полигона. На ней стоит заголовок. */
export const WATER_LINE = { desktop: 0.572, mobile: 0.575 } as const
/** Ближняя кромка воды. Ниже неё уже камень, ряби там быть не должно. */
export const WATER_NEAR = { desktop: 0.805, mobile: 1.0 } as const

/** Кадрирование фотографии. Дублирует `object-fit`/`object-position` в CSS. */
export const FIT = { px: 0.62, py: 0.58 } as const

export type Cover = {
  /** Смещение и размер отрисованной фотографии в координатах площадки. */
  ox: number
  oy: number
  dw: number
  dh: number
}

/**
 * Раскладка `object-fit: cover`, посчитанная руками.
 *
 * Нужна, потому что положение линии воды на экране не выводится из
 * разметки: это точка ФОТОГРАФИИ, а не элемента, и её экранная
 * координата зависит от того, как кадр обрезан под площадку.
 */
export function cover(cw: number, ch: number, iw: number, ih: number): Cover {
  const s = Math.max(cw / iw, ch / ih)
  const dw = iw * s
  const dh = ih * s
  return { ox: (cw - dw) * FIT.px, oy: (ch - dh) * FIT.py, dw, dh }
}

/** Точка фотографии (доли) → точка площадки (пиксели). */
export const toStage = (c: Cover, u: number, v: number) => ({
  x: c.ox + u * c.dw,
  y: c.oy + v * c.dh,
})

/** Точка площадки (пиксели) → точка фотографии (доли). */
export const toImage = (c: Cover, x: number, y: number) => ({
  u: (x - c.ox) / c.dw,
  v: (y - c.oy) / c.dh,
})

/** Луч вправо: чётное число пересечений — снаружи. */
export function inPoly(poly: [number, number][], u: number, v: number) {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/** Габарит полигона в координатах площадки, с запасом под смещение волны. */
export function poolRect(c: Cover, poly: [number, number][], padPx: number) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [u, v] of poly) {
    const p = toStage(c, u, v)
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  return { x: x0 - padPx, y: y0 - padPx, w: x1 - x0 + padPx * 2, h: y1 - y0 + padPx * 2 }
}
