/**
 * Ищет обрезанные нижние выносные в крупном наборе.
 *
 * У Kudryashev выносные длинные, а межстрочный в заголовках плотный.
 * Проверяем не на глаз: для каждой строки берём её линейный бокс,
 * считаем базовую линию по метрикам гарнитуры и прибавляем настоящий
 * вылет глифов ниже базовой линии — `actualBoundingBoxDescent` меряет
 * ровно тот текст, который стоит в этой строке.
 *
 * Две беды разные:
 *   срез  — ниже есть предок с overflow, и чернила уходят за его кромку;
 *   вылет — обрезки нет, но чернила выходят за собственный бокс строки
 *           и лезут на то, что стоит следом.
 */
import { chromium } from 'playwright'

const VIEWPORTS = [
  [1920, 1080],
  [2560, 1440],
  [390, 844],
]

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

for (const [w, h] of VIEWPORTS) {
  const ctx = await b.newContext({
    viewport: { width: w, height: h },
    reducedMotion: 'reduce',
    ...(w <= 860 ? { isMobile: true, hasTouch: true } : {}),
  })
  const p = await ctx.newPage()
  p.setDefaultTimeout(300000)
  await p.goto('http://127.0.0.1:8099/termaa/?steam=off', { waitUntil: 'networkidle' })
  await p.waitForTimeout(2000)

  const bad = await p.evaluate(() => {
    const cv = document.createElement('canvas')
    const cx = cv.getContext('2d')
    const out = []

    /** Ближайший предок, который реально обрезает содержимое. */
    const clipper = (el) => {
      for (let e = el.parentElement; e; e = e.parentElement) {
        const o = getComputedStyle(e)
        if (o.overflow !== 'visible' || o.overflowY !== 'visible') return e
      }
      return null
    }

    const seen = new Set()
    // Никакого списка селекторов: идём по всему документу и отбираем по
    // фактической гарнитуре и кеглю. Иначе легко пропустить заголовок,
    // который получил акциденцию через переменную, а не через класс.
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el)
      if (!/Kudryashev/.test(cs.fontFamily)) continue
      const fs = parseFloat(cs.fontSize)
      if (fs < 24) continue

      // Обходим текстовые узлы: линейные боксы даёт только Range.
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const text = n.textContent.trim()
        if (!text) continue
        const r = document.createRange()
        r.selectNodeContents(n)
        const rects = [...r.getClientRects()].filter((x) => x.height > 1)
        if (!rects.length) continue

        const own = n.parentElement
        const ocs = getComputedStyle(own)
        const size = parseFloat(ocs.fontSize)
        cx.font = `${ocs.fontWeight} ${size}px ${ocs.fontFamily}`
        const m = cx.measureText(text)
        const desc = m.actualBoundingBoxDescent
        // Область содержимого гарнитуры = (asc + desc) em; у Kudryashev
        // это 0.77 + 0.23 = 1.0 em. Полуинтерлиньяж делится поровну.
        const lineH = rects[0].height
        const half = (lineH - size) / 2
        const baseline = half + 0.77 * size

        const last = rects[rects.length - 1]
        const inkBottom = last.top + baseline + desc
        const clip = clipper(own)
        const key = (own.className || own.tagName) + '|' + text.slice(0, 24)
        if (seen.has(key)) continue

        if (clip) {
          const cb = clip.getBoundingClientRect().bottom
          if (inkBottom > cb + 0.5) {
            seen.add(key)
            out.push({
              вид: 'срез',
              где: own.className || own.tagName,
              текст: text.slice(0, 30),
              кегль: Math.round(size),
              межстрочный: +(lineH / size).toFixed(2),
              наСколько: +(inkBottom - cb).toFixed(1),
              обрезает: clip.className || clip.tagName,
            })
            continue
          }
        }
        // Межстрочный меньше единицы: выносные верхней строки могут
        // достать до верхних элементов следующей. Считаем по чернилам,
        // а не по боксам — боксы при таком интерлиньяже всегда впритык.
        if (rects.length > 1) {
          const asc = m.actualBoundingBoxAscent
          for (let i = 0; i < rects.length - 1; i++) {
            const bot = rects[i].top + baseline + desc
            const topNext = rects[i + 1].top + baseline - asc
            if (bot > topNext + 0.5) {
              seen.add(key)
              out.push({
                вид: 'наезд',
                где: own.className || own.tagName,
                текст: text.slice(0, 30),
                кегль: Math.round(size),
                межстрочный: +(lineH / size).toFixed(2),
                наСколько: +(bot - topNext).toFixed(1),
              })
              break
            }
          }
          if (seen.has(key)) continue
        }

        if (inkBottom > last.bottom + 0.5) {
          seen.add(key)
          out.push({
            вид: 'вылет',
            где: own.className || own.tagName,
            текст: text.slice(0, 30),
            кегль: Math.round(size),
            межстрочный: +(lineH / size).toFixed(2),
            наСколько: +(inkBottom - last.bottom).toFixed(1),
          })
        }
      }
    }
    return out
  })

  console.log(`\n── ${w}×${h} ──`)
  if (!bad.length) console.log('  чисто')
  for (const x of bad) {
    console.log(
      `  ${x.вид.padEnd(6)} ${String(x.где).padEnd(18)} «${x.текст}» ` +
        `кегль ${x.кегль} межстр ${x.межстрочный} → на ${x.наСколько}px` +
        (x.обрезает ? ` (обрезает .${x.обрезает})` : ''),
    )
  }
  await ctx.close()
}

await b.close()
