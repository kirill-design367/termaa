/**
 * Проверка смены зон: двух текстов в кадре быть не может.
 *
 * Проверяется не на глаз, а по фактической непрозрачности: для каждой
 * точки прогресса считаем, сколько блоков текста реально видимы. Больше
 * одного — ошибка. Заодно снимаются кадры 20/40/60/80 % каждого перехода.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import path from 'node:path'

const OUT = '/workspace/shots/rep'
const W = 1920
const H = 1080
const POINTS = [0.2, 0.4, 0.6, 0.8]

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
})
const p = await ctx.newPage()
p.setDefaultTimeout(600000)
p.on('pageerror', (e) => console.log('!!', e.message.slice(0, 200)))

await p.goto('http://127.0.0.1:8099/termaa/?steam=off', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)

const geo = await p.evaluate(() => {
  const top = (el) => Math.round(el.getBoundingClientRect().top + window.scrollY)
  const z = document.querySelector('.zones')
  return { zonesTop: top(z), vh: window.innerHeight }
})

/** Сколько текстов реально видно и какие. */
const visible = () =>
  p.evaluate(() => {
    const out = []
    document.querySelectorAll('.zone').forEach((z) => {
      const inner = z.querySelector('.zone__in')
      const cz = getComputedStyle(z)
      const ci = getComputedStyle(inner)
      // Итоговая видимость текста — произведение по цепочке.
      const a = parseFloat(cz.opacity) * parseFloat(ci.opacity)
      const hidden = cz.visibility === 'hidden' || ci.visibility === 'hidden'
      if (!hidden && a > 0.02) {
        out.push({ имя: z.querySelector('.zone__name').textContent, альфа: +a.toFixed(3) })
      }
    })
    return out
  })

let bad = 0
const tiles = []
const tw = 480
const th = Math.round((tw / W) * H)

for (let t = 0; t < 3; t++) {
  for (const frac of POINTS) {
    const y = geo.zonesTop + Math.round(geo.vh * (t + frac))
    await p.evaluate((v) => window.scrollTo(0, v), y)
    await p.waitForTimeout(950)
    const v = await visible()
    const pct = Math.round(frac * 100)
    const ok = v.length <= 1
    if (!ok) bad++
    console.log(
      `переход ${t + 1}→${t + 2}, ${pct}%: ` +
        (v.length ? v.map((x) => `${x.имя} ${x.альфа}`).join(' + ') : 'текста нет') +
        (ok ? '' : '   ❌ ДВА ТЕКСТА'),
    )
    // Кадры снимаем для первого перехода — он и был на присланном снимке.
    if (t === 0) {
      const f = path.join(OUT, `7-zone-tr-${pct}.png`)
      await p.screenshot({ path: f })
      const tf = f.replace('.png', '-t.png')
      await sharp(f).resize({ width: tw }).toFile(tf)
      tiles.push({ input: tf, left: tiles.length * tw, top: 0 })
    }
  }
}

await sharp({ create: { width: tw * 4, height: th, channels: 3, background: '#16130f' } })
  .composite(tiles)
  .png()
  .toFile(path.join(OUT, '7-zone-transition.png'))

await b.close()
console.log(bad ? `ПРОВАЛ: ${bad} точек с двумя текстами` : 'двух текстов нет ни в одной точке')
