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
    '--font-text': `'${t.family}', system-ui, sans-serif`,
    '--wm-cap': d.capR,
    '--wm-sum': wordmarkSum(d),
    '--wm-drop': wordmarkDrop(d),
    '--display-w': pair.displayWeight,
    // Слой потёка для наведения: адрес учитывает basePath.
    '--drip': `url(${A('/img/drip.webp')})`,
  } as CSSProperties
}
