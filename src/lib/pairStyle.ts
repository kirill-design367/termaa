import type { CSSProperties } from 'react'
import { METRICS, wordmarkDrop, wordmarkSum, type Pair } from './fonts'

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
  } as CSSProperties
}
