import { A } from '@/lib/asset'
import { METRICS } from '@/lib/fonts'

/**
 * `@font-face` для всех гарнитур проекта. В globals.css их нет намеренно:
 * пути к файлам зависят от basePath, а он приходит из окружения.
 *
 * display: swap — кроме вордмарка, ему нужен block: подменённый системным
 * шрифтом вордмарк на долю секунды разъезжает всю композицию.
 *
 * Отдельным начертанием идёт знак рубля. В Gramatika его нет, а он стоит
 * в каждой цене: `unicode-range` заставляет браузер взять ровно этот
 * символ из другой гарнитуры, не трогая остальной набор.
 */
export function FontFaces() {
  const faces = Object.values(METRICS).map((m) => {
    const range = m.variable
      ? `font-weight: ${m.wght[0]} ${m.wght[1]};`
      : `font-weight: ${m.wght[0]};`
    const swap = m.role === 'display' ? 'block' : 'swap'
    return `@font-face{font-family:'${m.family}';src:url('${A(
      `/fonts/${m.file}`,
    )}') format('woff2');${range}font-style:normal;font-display:${swap};}`
  })

  faces.push(
    `@font-face{font-family:'Rub';src:url('${A(
      '/fonts/rub.woff2',
    )}') format('woff2');unicode-range:U+20BD;font-display:swap;}`,
  )

  return <style dangerouslySetInnerHTML={{ __html: faces.join('') }} />
}
