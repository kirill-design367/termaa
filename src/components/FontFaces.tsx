import { A } from '@/lib/asset'
import { METRICS } from '@/lib/fonts'

/**
 * @font-face для всех шести гарнитур. В globals.css их нет намеренно:
 * пути к файлам зависят от basePath, а он приходит из окружения.
 *
 * display: swap — кроме вордмарка, ему нужен block: подменённый
 * системным шрифтом вордмарк на долю секунды разъезжает всю композицию.
 */
export function FontFaces() {
  const css = Object.values(METRICS)
    .map((m) => {
      const range = m.variable ? `font-weight: ${m.wght[0]} ${m.wght[1]};` : 'font-weight: 400;'
      const swap = m.role === 'display' ? 'block' : 'swap'
      return `@font-face{font-family:'${m.family}';src:url('${A(
        `/fonts/${m.file}`,
      )}') format('woff2');${range}font-style:normal;font-display:${swap};}`
    })
    .join('')

  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
