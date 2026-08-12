/**
 * Стоимость кадра в ПОКОЕ: страница стоит на герое, ничего не
 * прокручивается, работает только приём. Именно это и есть цена
 * эффекта — всё остальное в покое не двигается.
 *
 * Абсолютные кадры в секунду тут ничего не значат: в контейнере нет
 * видеокарты, растеризация программная. Значимо отношение одного
 * дерева к другому, снятое одной и той же пробой.
 */
import { chromium } from 'playwright'

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await p.goto(process.env.U || 'http://127.0.0.1:8099/termaa/', { waitUntil: 'networkidle' })
await p.waitForTimeout(3500)
const r = await p.evaluate(
  () =>
    new Promise((res) => {
      const t = []
      let last = performance.now()
      let n = 0
      const tick = (now) => {
        t.push(now - last)
        last = now
        if (++n < 140) requestAnimationFrame(tick)
        else {
          t.sort((a, z) => a - z)
          res({
            med: +(1000 / t[t.length >> 1]).toFixed(1),
            ms: +t[t.length >> 1].toFixed(1),
            p95: +t[Math.floor(t.length * 0.95)].toFixed(1),
          })
        }
      }
      requestAnimationFrame(tick)
    }),
)
console.log(`${process.argv[2] || 'покой'}: медиана ${r.med} кадр/с (${r.ms} мс на кадр) · худший ${r.p95} мс`)
await b.close()
