/**
 * Финальные кадры и проверки: герой целиком, вордмарк вблизи,
 * гасится ли объём за пределами героя, замер fps.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import path from 'node:path'

const OUT = '/workspace/shots/rep'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
})
const p = await ctx.newPage()
p.setDefaultTimeout(600000)
p.on('pageerror', (e) => console.log('!!', e.message.slice(0, 200)))

// ── Герой и вордмарк (ручной шаг: иначе на SwiftShader кадр не успевает) ─
await p.goto('http://127.0.0.1:8099/termaa/?steam=force&steps=14&manual=1', {
  waitUntil: 'networkidle',
})
await p.waitForFunction(() => !!window.__steam, null, { timeout: 30000 })
await p.evaluate(() => window.__steam.run(4, 15))
await p.screenshot({ path: path.join(OUT, '2-hero.png') })
await sharp(path.join(OUT, '2-hero.png'))
  .extract({ left: 90, top: 760, width: 1240, height: 320 })
  .toFile(path.join(OUT, '3-wordmark.png'))
await sharp(path.join(OUT, '2-hero.png'))
  .extract({ left: 640, top: 830, width: 640, height: 250 })
  .resize({ width: 1280, kernel: 'lanczos3' })
  .toFile(path.join(OUT, '3-wordmark-zoom.png'))
await ctx.close()

// ── Гасится ли объём, когда герой ушёл из кадра ──────────────────────
const ctx2 = await b.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
})
const q = await ctx2.newPage()
q.setDefaultTimeout(600000)
await q.goto('http://127.0.0.1:8099/termaa/?steam=force&steps=10', {
  waitUntil: 'networkidle',
})
await q.waitForTimeout(6000)
// Счётчик кадров объёма снимаем косвенно: сколько раз сработал rAF
// внутри симуляции, видно по времени — вместо этого меряем загрузку,
// сравнивая частоту rAF страницы в герое и далеко под ним.
const rafHz = () =>
  q.evaluate(
    () =>
      new Promise((res) => {
        const t = []
        let last = performance.now()
        let n = 0
        const tick = () => {
          const now = performance.now()
          t.push(now - last)
          last = now
          if (++n < 40) requestAnimationFrame(tick)
          else {
            t.sort((a, b) => a - b)
            res(+(1000 / t[t.length >> 1]).toFixed(1))
          }
        }
        requestAnimationFrame(tick)
      }),
  )
const inHero = await rafHz()
await q.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await q.waitForTimeout(2500)
const belowHero = await rafHz()
console.log(`rAF в герое: ${inHero} Гц · вне героя: ${belowHero} Гц`)
console.log(
  'сторож fps:',
  await q.evaluate(() => window.__steamFps ?? null),
)
await b.close()
