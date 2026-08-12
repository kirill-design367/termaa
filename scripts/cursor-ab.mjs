/**
 * А/Б реакции на курсор.
 *
 * Пар дрейфует сам по себе, поэтому просто сравнить два кадра во времени
 * нельзя — разница будет от дрейфа, а не от курсора. Прогоняем один и тот
 * же модельный отрезок дважды: с курсором и без, и вычитаем. Что осталось —
 * и есть чистая реакция.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import path from 'node:path'

const OUT = '/workspace/shots/rep'
const W = 1920
const H = 1080
const PHASES = [
  ['move', 0],
  ['plus200', 0.2],
  ['plus500', 0.3],
  ['plus1000', 0.5],
]

const run = async (b, withCursor) => {
  const ctx = await b.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  })
  const p = await ctx.newPage()
  p.setDefaultTimeout(900000)
  await p.goto('http://127.0.0.1:8099/termaa/?steam=force&steps=14&manual=1', {
    waitUntil: 'networkidle',
  })
  await p.waitForFunction(() => !!window.__steam, null, { timeout: 30000 })
  await p.evaluate(() => window.__steam.run(3, 12))

  const files = {}
  // Одинаковый отрезок времени в обеих прогонках; курсор — только в одной.
  await p.evaluate((on) => {
    for (let i = 0; i <= 20; i++) {
      if (on) window.__steam.point(620 + i * 14, 440 + Math.sin(i / 4) * 26)
      window.__steam.run(1 / 60)
    }
    window.__steam.leave()
  }, withCursor)

  for (const [name, wait] of PHASES) {
    if (wait) await p.evaluate((s) => window.__steam.run(s), wait)
    const f = path.join(OUT, `ab-${withCursor ? 'on' : 'off'}-${name}.png`)
    await p.screenshot({ path: f })
    files[name] = f
  }
  await ctx.close()
  return files
}

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const on = await run(b, true)
const off = await run(b, false)
await b.close()

for (const [name] of PHASES) {
  const a = await sharp(on[name]).greyscale().raw().toBuffer({ resolveWithObject: true })
  const c = await sharp(off[name]).greyscale().raw().toBuffer()
  const { width, height } = a.info
  const out = Buffer.alloc(width * height)
  let sum = 0
  let max = 0
  for (let i = 0; i < out.length; i++) {
    const d = Math.abs(a.data[i] - c[i])
    sum += d
    if (d > max) max = d
    out[i] = Math.min(255, d * 20)
  }
  await sharp(out, { raw: { width, height, channels: 1 } })
    .png()
    .toFile(path.join(OUT, `ab-diff-${name}.png`))
  console.log(name.padEnd(10), 'средняя', (sum / out.length).toFixed(3), 'макс', max)
}
