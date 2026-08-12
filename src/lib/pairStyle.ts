import type { CSSProperties } from 'react'
import { METRICS, wordmarkDrop, wordmarkSum, type Pair } from './fonts'
import { A } from './asset'

/**
 * Переменные пары шрифтов. Их читают и типографика, и геометрия
 * вордмарка — поэтому смена пары на /fonts меняет композицию целиком,
 * а не только начертание.
 */
export function pairVars(pair: Pair): CSSProperties {
  const d = METRICS[pair.display]
  const t = METRICS[pair.text]
  return {
    '--font-display': `'${d.family}', Georgia, serif`,
    // 'Rub' стоит первым и покрывает ровно один знак — ₽. Всё остальное
    // берётся из текстовой гарнитуры, как и должно.
    '--font-text': `'Rub', '${t.family}', system-ui, sans-serif`,
    '--wm-cap': d.capR,
    '--wm-sum': wordmarkSum(d),
    '--wm-drop': wordmarkDrop(d),
    '--display-w': pair.displayWeight,
    // Испечённые слои: адреса учитывают basePath, потому что webpack
    // отказывается оставлять литеральный url() в CSS в покое.
    '--drip': `url(${A('/img/drip.webp')})`,
    '--frost': `url(${A('/img/frost.webp')})`,
    // Маска бассейна сюда больше не ходит: воду рисует холст, и он
    // берёт её текстурой напрямую — CSS о ней ничего не знает.
  } as CSSProperties
}
