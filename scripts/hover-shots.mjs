/**
 * Кадры потёка и стыка hero со следующим блоком.
 *
 * Потёк снимается не «на глазок»: наводим курсор, находим запущенную
 * анимацию через getAnimations() и ставим её на нужную миллисекунду.
 * Так кадр воспроизводим и не зависит от того, как медленно рисует
 * программный рендерер.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import path from 'node:path'

const OUT = '/workspace/shots/rep'
const W = 1920
const H = 1080

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
})
const p = await ctx.newPage()
p.setDefaultTimeout(300000)
p.on('pageerror', (e) => console.log('!!', e.message.slice(0, 200)))

await p.goto('http://127.0.0.1:8099/termaa/?steam=off', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)

/** Ставит потёк выбранного элемента на заданную миллисекунду. */
const freeze = (sel, ms) =>
  p.evaluate(
    ([s, t]) => {
      const el = document.querySelector(s)
      const a = el.getAnimations({ subtree: true }).filter((x) => x.animationName?.startsWith('drip'))
      a.forEach((x) => {
        x.pause()
        x.currentTime = t
      })
      return a.length
    },
    [sel, ms],
  )

// ── 5. Кнопка героя: потёк на середине пути ────────────────────────
const btn = p.locator('.hero .btn').first()
const box = await btn.boundingBox()
await btn.hover()
await p.waitForTimeout(60)
console.log('анимаций на кнопке:', await freeze('.hero .btn', 240))
await p.screenshot({ path: path.join(OUT, '5-btn-hover.png') })
await sharp(path.join(OUT, '5-btn-hover.png'))
  .extract({
    left: Math.max(0, Math.round(box.x) - 40),
    top: Math.max(0, Math.round(box.y) - 50),
    width: 620,
    height: 190,
  })
  .resize({ width: 1240 })
  .toFile(path.join(OUT, '5-btn-crop.png'))

// Три фазы потёка подряд — видно, что он идёт сверху вниз.
for (const [i, ms] of [90, 250, 480].entries()) {
  await freeze('.hero .btn', ms)
  const f = path.join(OUT, `5-drip-${i + 1}.png`)
  await p.screenshot({ path: f })
  await sharp(f)
    .extract({
      left: Math.max(0, Math.round(box.x) - 20),
      top: Math.max(0, Math.round(box.y) - 26),
      width: 260,
      height: 120,
    })
    .resize({ width: 780 })
    .toFile(f.replace('.png', '-crop.png'))
}

// ── Ссылка навигации: та же механика ───────────────────────────────
const link = p.locator('.hdr__link').first()
const lbox = await link.boundingBox()
await link.hover()
await p.waitForTimeout(60)
console.log('анимаций на ссылке:', await freeze('.hdr__link', 220))
const lf = path.join(OUT, '5-link-hover.png')
await p.screenshot({ path: lf })
await sharp(lf)
  .extract({
    left: Math.max(0, Math.round(lbox.x) - 30),
    top: 0,
    width: 460,
    height: 90,
  })
  .resize({ width: 1380 })
  .toFile(lf.replace('.png', '-crop.png'))

await b.close()
console.log('готово')
