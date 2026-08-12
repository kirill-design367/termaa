/**
 * Плёнка потёка: шесть фаз одной анимации в ряд.
 *
 * Судить по одному кадру нельзя — видно ли, что капля идёт сверху вниз
 * и след затягивается, показывает только последовательность.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import path from 'node:path'

const OUT = '/workspace/shots/rep'
const MS = [40, 140, 260, 380, 500, 590]

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  reducedMotion: 'no-preference',
})
const p = await ctx.newPage()
p.setDefaultTimeout(300000)
await p.goto('http://127.0.0.1:8099/termaa/?steam=off', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)

const btn = p.locator('.hero .btn').first()
const box = await btn.boundingBox()
await btn.hover()
await p.waitForTimeout(60)

const tiles = []
for (const ms of MS) {
  await p.evaluate((t) => {
    document
      .querySelector('.hero .btn')
      .getAnimations({ subtree: true })
      .filter((x) => x.animationName?.startsWith('drip'))
      .forEach((x) => {
        x.pause()
        x.currentTime = t
      })
  }, ms)
  const f = path.join(OUT, `_strip-${ms}.png`)
  await p.screenshot({ path: f })
  // deviceScaleFactor 2 — координаты бокса в CSS-пикселях, буфер вдвое.
  const t = path.join(OUT, `_tile-${ms}.png`)
  await sharp(f)
    .extract({
      left: Math.round((box.x - 14) * 2),
      top: Math.round((box.y - 14) * 2),
      width: Math.round((box.width + 28) * 2),
      height: Math.round((box.height + 28) * 2),
    })
    .toFile(t)
  tiles.push({ input: t, left: tiles.length * Math.round((box.width + 28) * 2), top: 0 })
}
await b.close()

const tw = Math.round((box.width + 28) * 2)
const th = Math.round((box.height + 28) * 2)
await sharp({
  create: { width: tw * MS.length, height: th, channels: 3, background: '#5d564b' },
})
  .composite(tiles)
  .png()
  .toFile(path.join(OUT, '5-drip-strip.png'))
console.log('фазы, мс:', MS.join(' · '))
