/** Три кадра прокрутки героя: кадр уходит целиком. */
import { chromium } from 'playwright'
import sharp from 'sharp'
const OUT = process.env.OUT || '/workspace/shots/rep'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await p.goto('http://127.0.0.1:8099/termaa/', { waitUntil: 'networkidle' })
await p.waitForTimeout(2600)
const len = await p.evaluate(() => document.querySelector('.hero').getBoundingClientRect().height - innerHeight)
const files = []
for (const f of [0, 0.34, 0.68]) {
  await p.evaluate((v) => window.scrollTo(0, v), Math.round(len * f))
  await p.waitForTimeout(900)
  const g = `${OUT}/_sc-${f}.png`
  await sharp(await p.screenshot()).resize(880).toFile(g)
  files.push(g)
  console.log('прогресс', f)
}
const m = await sharp(files[0]).metadata()
await sharp({ create: { width: m.width, height: m.height * 3 + 12, channels: 3, background: '#16130f' } })
  .composite(files.map((f, i) => ({ input: f, top: i * (m.height + 6), left: 0 })))
  .toFile(`${OUT}/3-scroll.png`)
console.log('полоса собрана')
await b.close()
