/**
 * Развитие сцены героя по скроллу и распределение потока по ширине.
 *
 * Прогресс ставится напрямую через ручной хук, а не прокруткой: на
 * программном рендерере кадр идёт секунду, и попасть скроллом ровно в
 * 35 % нельзя. Значение то же самое, что пишет мастер-таймлайн.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import path from 'node:path'

const OUT = '/workspace/shots/rep'
const W = 1920
const H = 1080
const STEPS = [0, 0.35, 0.7, 1]

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
})
const p = await ctx.newPage()
p.setDefaultTimeout(900000)
p.on('pageerror', (e) => console.log('!!', e.message.slice(0, 200)))
p.on('console', (m) => {
  if (m.type() === 'error') console.log('ERR', m.text().slice(0, 200))
})

await p.goto('http://127.0.0.1:8099/termaa/?steam=force&steps=14&manual=1', {
  waitUntil: 'networkidle',
})
await p.waitForFunction(() => !!window.__steam, null, { timeout: 30000 })

const files = []
for (const s of STEPS) {
  await p.evaluate((v) => window.__steam.progress(v), s)
  // Прокручиваем страницу в ту же точку, чтобы разметка тоже отработала.
  await p.evaluate((v) => {
    const hero = document.querySelector('.hero')
    window.scrollTo(0, (hero.offsetHeight - window.innerHeight) * v)
  }, s)
  await p.evaluate(() => window.__steam.run(2.2, 12))
  const f = path.join(OUT, `s-${Math.round(s * 100)}.png`)
  await p.screenshot({ path: f })
  files.push(f)
  console.log('снят', Math.round(s * 100) + '%')
}

// Полоса из четырёх фаз.
const tw = 480
const th = Math.round((tw / W) * H)
const tiles = []
for (const [i, f] of files.entries()) {
  const t = f.replace('.png', '-t.png')
  await sharp(f).resize({ width: tw }).toFile(t)
  tiles.push({ input: t, left: i * tw, top: 0 })
}
await sharp({ create: { width: tw * files.length, height: th, channels: 3, background: '#16130f' } })
  .composite(tiles)
  .png()
  .toFile(path.join(OUT, '4-scene-strip.png'))

// ── Распределение потока по ширине: разница с выключенным паром ───────
await p.evaluate(() => window.__steam.progress(0))
await p.evaluate(() => window.scrollTo(0, 0))
await p.evaluate(() => window.__steam.run(2, 12))
const on = path.join(OUT, '_w-on.png')
await p.screenshot({ path: on })
await ctx.close()

const c2 = await b.newContext({ viewport: { width: W, height: H }, reducedMotion: 'no-preference' })
const q = await c2.newPage()
await q.goto('http://127.0.0.1:8099/termaa/?steam=off', { waitUntil: 'networkidle' })
await q.waitForTimeout(2500)
const off = path.join(OUT, '_w-off.png')
await q.screenshot({ path: off })
await b.close()

const A = await sharp(on).greyscale().raw().toBuffer({ resolveWithObject: true })
const B = await sharp(off).greyscale().raw().toBuffer()
const { width, height } = A.info
const cols = 12
const bucket = new Array(cols).fill(0)
const count = new Array(cols).fill(0)
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const k = Math.min(cols - 1, Math.floor((x / width) * cols))
    bucket[k] += Math.abs(A.data[y * width + x] - B[y * width + x])
    count[k]++
  }
}
console.log(
  'вклад пара по колонкам слева направо:',
  bucket.map((v, i) => (v / count[i]).toFixed(1)).join(' '),
)
