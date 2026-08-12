'use client'

import { A } from '@/lib/asset'

/**
 * Восходящий поток на испечённых слоях.
 *
 * Работает там, где объёма нет: на мобильной, в `prefers-reduced-motion`,
 * на машинах, где сторож снял симуляцию, — и сквозь всю остальную
 * страницу, где он и есть то связующее вещество, которое нигде не
 * обрывается.
 *
 * Колонны разной ширины, скорости и прозрачности идут вверх бесконечным
 * `translateY`. Плитка стыкуется по вертикали, поэтому цикла не видно:
 * клуб, ушедший за верх, входит снизу. Анимируется только трансформ.
 */

type Col = {
  /** Левый край в долях ширины и ширина колонны. */
  x: number
  w: number
  /** Плитка: крупные ближние клубы или мелкие дальние. */
  tile: 1 | 2
  /** Секунды на полный проход. Ближние быстрее. */
  dur: number
  op: number
  /** Сдвиг фазы, чтобы колонны не шли строем. */
  delay: number
}

/** Колонны кроют всю ширину кадра, до левого и правого края. */
const COLS: Col[] = [
  { x: -0.06, w: 0.3, tile: 2, dur: 78, op: 0.3, delay: -11 },
  { x: 0.09, w: 0.26, tile: 1, dur: 52, op: 0.46, delay: -34 },
  { x: 0.26, w: 0.22, tile: 2, dur: 88, op: 0.26, delay: -5 },
  { x: 0.39, w: 0.3, tile: 1, dur: 46, op: 0.5, delay: -22 },
  { x: 0.56, w: 0.24, tile: 2, dur: 71, op: 0.29, delay: -47 },
  { x: 0.68, w: 0.28, tile: 1, dur: 58, op: 0.42, delay: -16 },
  { x: 0.82, w: 0.24, tile: 2, dur: 94, op: 0.24, delay: -29 },
]

export function SteamFlow({ dense = 1 }: { dense?: number }) {
  return (
    <div className="flow" aria-hidden="true">
      {COLS.map((c, i) => (
        <i
          key={i}
          className="flow__c"
          style={
            {
              left: `${c.x * 100}%`,
              width: `${c.w * 100}%`,
              opacity: c.op * dense,
              backgroundImage: `url(${A(`/img/plume-${c.tile}.webp`)})`,
              animationDuration: `${c.dur}s`,
              animationDelay: `${c.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
