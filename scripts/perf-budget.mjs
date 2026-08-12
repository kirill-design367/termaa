/**
 * Бюджет кадра: что стоит дорого в покое и на прокрутке.
 *
 * Меряется без воды (`?water=off`) — иначе всё съедает программный
 * рендерер контейнера, и разницу в стоимости разметки не увидеть.
 * Числа воспроизводимые: состав слоёв считается по вычисленным стилям,
 * частота кадров — по медиане межкадровых интервалов на скрипте прокрутки.
 */
import { chromium } from 'playwright'

const W = 1920
const H = 1080

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
})
const p = await ctx.newPage()
p.setDefaultTimeout(600000)

await p.goto('http://127.0.0.1:8099/termaa/?water=off', { waitUntil: 'networkidle' })
await p.waitForTimeout(3000)

/** Состав кадра в покое: что промотировано и что маскируется. */
const layers = await p.evaluate(() => {
  let wc = 0
  let masks = 0
  let anims = 0
  let filters = 0
  const wcList = {}
  const maskList = {}
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el)
    const key = el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName
    if (cs.willChange && cs.willChange !== 'auto') {
      wc++
      wcList[key] = (wcList[key] || 0) + 1
    }
    const mi = cs.maskImage || cs.webkitMaskImage
    if (mi && mi !== 'none') {
      masks++
      maskList[key] = (maskList[key] || 0) + 1
    }
    if (cs.animationName && cs.animationName !== 'none') anims++
    if (cs.filter && cs.filter !== 'none') filters++
  }
  return { wc, masks, anims, filters, wcList, maskList }
})

console.log(`промотировано will-change: ${layers.wc}`)
console.log('  ', JSON.stringify(layers.wcList))
console.log(`масок в кадре: ${layers.masks}`)
console.log('  ', JSON.stringify(layers.maskList))
console.log(`бесконечных анимаций: ${layers.anims} · живых фильтров: ${layers.filters}`)

/** Частота кадров на скрипте прокрутки. */
const fps = async (label, from, to) => {
  await p.evaluate((v) => window.scrollTo(0, v), from)
  await p.waitForTimeout(600)
  const r = await p.evaluate(
    ([a, z]) =>
      new Promise((res) => {
        const t = []
        let last = performance.now()
        let n = 0
        const N = 100
        const tick = (now) => {
          t.push(now - last)
          last = now
          window.scrollTo(0, a + ((z - a) * n) / N)
          if (++n < N) requestAnimationFrame(tick)
          else {
            t.sort((x, y) => x - y)
            const med = t[t.length >> 1]
            const p95 = t[Math.floor(t.length * 0.95)]
            res({ med: +(1000 / med).toFixed(1), worst: +p95.toFixed(1) })
          }
        }
        requestAnimationFrame(tick)
      }),
    [from, to],
  )
  console.log(`${label}: медиана ${r.med} кадр/с · худший кадр ${r.worst} мс`)
  return r
}

const doc = await p.evaluate(() => document.body.scrollHeight - window.innerHeight)

await fps('прокрутка героя      ', 0, Math.round(doc * 0.14))
await fps('прокрутка второй сцены', Math.round(doc * 0.18), Math.round(doc * 0.34))
await fps('прокрутка всей страницы', 0, doc)

// Наведение на кнопку героя: сколько стоит сама анимация.
await p.evaluate(() => window.scrollTo(0, 0))
await p.waitForTimeout(700)
const hov = await p.evaluate(
  () =>
    new Promise((res) => {
      const btn = document.querySelector('.hero .btn')
      btn.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))
      const t = []
      let last = performance.now()
      let n = 0
      const tick = (now) => {
        t.push(now - last)
        last = now
        if (++n < 45) requestAnimationFrame(tick)
        else {
          t.sort((x, y) => x - y)
          res({ med: +(1000 / t[t.length >> 1]).toFixed(1), worst: +t[t.length - 2].toFixed(1) })
        }
      }
      requestAnimationFrame(tick)
    }),
)
console.log(`наведение на кнопку  : медиана ${hov.med} кадр/с · худший кадр ${hov.worst} мс`)

await b.close()
