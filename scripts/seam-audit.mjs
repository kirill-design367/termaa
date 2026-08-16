/**
 * Поиск швов по всей длине полотна.
 *
 * Шов — это стойкая тональная СТУПЕНЬ во всю ширину: яркость по одну
 * сторону строки заметно иная, чем по другую, и такой она и остаётся.
 * Линейка в шапке блока или разделитель аккордеона тоже дают резкий
 * скачок, но через несколько строк яркость возвращается — это приём
 * набора, а не шов между сценами, и в счёт он не идёт.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'

const W = 1920
const H = 1080
/** Порог скачка средней яркости строки, в уровнях 0..255. */
const JUMP = 6
/** Насколько строка должна быть однородна, чтобы считаться чертой. */
const FLAT = 26

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
})
const p = await ctx.newPage()
p.setDefaultTimeout(600000)
await p.goto(`${process.env.U || 'http://127.0.0.1:8099/termaa/'}?water=off`, { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)

const total = await p.evaluate(() => document.body.scrollHeight - window.innerHeight)
const shots = 16
let found = 0

for (let i = 0; i <= shots; i++) {
  const y = Math.round((total * i) / shots)
  await p.evaluate((v) => window.scrollTo(0, v), y)
  await p.waitForTimeout(700)
  const buf = await p.screenshot()
  const r = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = r.info

  const mean = new Float64Array(height)
  const spread = new Float64Array(height)
  for (let row = 0; row < height; row++) {
    let s = 0
    let lo = 255
    let hi = 0
    for (let x = 0; x < width; x++) {
      const v = r.data[row * width + x]
      s += v
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    mean[row] = s / width
    spread[row] = hi - lo
  }

  const hits = []
  const band = 10
  for (let row = band; row < height - band; row++) {
    // Ступень: средняя яркость до и после полосы устойчиво разная.
    let lo = 0
    let hi = 0
    for (let k = 1; k <= band; k++) {
      lo += mean[row - k]
      hi += mean[row + k]
    }
    const d = Math.abs(hi / band - lo / band)
    // Ступень отличается от градиента тем, что почти вся разница
    // приходится на одну-две строки. Плавный переход этого не даёт —
    // и именно поэтому он и не читается как граница.
    const local = Math.abs(mean[row + 1] - mean[row - 1])
    if (d >= JUMP && local >= d * 0.5 && spread[row] <= FLAT) {
      hits.push(`${row}(Δ${d.toFixed(1)})`)
    }
  }
  if (hits.length) {
    found += hits.length
    console.log(`скролл ${y}: черта на строках ${hits.slice(0, 6).join(' ')}`)
  }
}

await b.close()
console.log(found ? `НАЙДЕНО ШВОВ: ${found}` : 'швов не найдено')
