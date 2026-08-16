/**
 * Отражение имени в воде: кадр с ним и кадр без него.
 *
 * Пара нужна потому, что отражение по замыслу тихое — 25 % плотности,
 * сжатое по вертикали и разбитое той же рябью. По одному снимку не
 * доказать, что оно вообще есть; по паре — видно сразу.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'

const URL = process.env.U || 'http://127.0.0.1:8099/termaa/'
const OUT = process.env.OUT || '/workspace/shots/rep'
/* Полоса воды сразу под базовой линией слова, левая половина кадра:
   отсветов павильона там нет, и белое отражение видно чисто. */
const CROP = { left: 30, top: 655, width: 1130, height: 275 }
const T = 4.0

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await p.goto(`${URL}?water=1`, { waitUntil: 'networkidle' })
await p.waitForTimeout(2800)

await p.evaluate((t) => {
  window.__water.clear()
  window.__water.freeze(t)
}, T)
await p.waitForTimeout(300)
console.log('отражение на холсте:', JSON.stringify(await p.evaluate(() => window.__water.reflStat())))

const shot = async (f) => {
  await sharp(await p.screenshot()).extract(CROP).toFile(f)
  return f
}
const on = await shot(`${OUT}/_rf-on.png`)

await p.evaluate(() => {
  window.__water.clearRefl()
})
await p.waitForTimeout(300)
const off = await shot(`${OUT}/_rf-off.png`)

await sharp({
  create: { width: CROP.width, height: CROP.height * 2 + 6, channels: 3, background: '#16130f' },
})
  .composite([
    { input: on, top: 0, left: 0 },
    { input: off, top: CROP.height + 6, left: 0 },
  ])
  .toFile(`${OUT}/5-reflection.png`)
console.log('полоса собрана: сверху с отражением, снизу без него')
await b.close()
