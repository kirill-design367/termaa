/**
 * Стык героя со второй сценой.
 *
 * Пар был связующим веществом между сценами; его больше нет, и переход
 * собран заново на движении содержимого, масштабе и свете. Проверяется
 * ровно одно: в любой точке перехода в кадре не должно быть прямой
 * тональной ступени во всю ширину — ни кромки фотографии, ни кромки
 * холста воды, ни границы следующей сцены.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'

const W = 1920
const H = 1080
const OUT = process.env.OUT || '/workspace/shots/rep'

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await p.goto('http://127.0.0.1:8099/termaa/', { waitUntil: 'networkidle' })
await p.waitForTimeout(2600)

const heroLen = await p.evaluate(
  () => document.querySelector('.hero').offsetHeight - window.innerHeight,
)

const steps = [0, 0.3, 0.5, 0.65, 0.8, 1]
const files = []
let worst = 0
let worstAt = ''

for (const s of steps) {
  const y = Math.round(heroLen * s)
  await p.evaluate((v) => window.scrollTo(0, v), y)
  await p.waitForTimeout(900)
  const buf = await p.screenshot()
  const f = `${OUT}/_jn-${Math.round(s * 100)}.png`
  await sharp(buf).resize(640).toFile(f)
  files.push(f)

  // Ступень: скачок средней яркости строки на ровных, однородных строках.
  const r = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true })
  const mean = new Float64Array(H)
  const flat = new Float64Array(H)
  for (let row = 0; row < H; row++) {
    let sum = 0
    let lo = 255
    let hi = 0
    for (let x = 0; x < W; x++) {
      const v = r.data[row * W + x]
      sum += v
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    mean[row] = sum / W
    flat[row] = hi - lo
  }
  // Полоса шапки исключена: у плашки под навигацией своя нижняя
  // кромка, она задумана и живёт независимо от стыка сцен.
  for (let row = 96; row < H - 12; row++) {
    if (flat[row] > 26) continue
    let a = 0
    let z = 0
    for (let k = 1; k <= 8; k++) {
      a += mean[row - k - 3]
      z += mean[row + k + 3]
    }
    const d = Math.abs(a - z) / 8
    if (d > worst) {
      worst = d
      worstAt = `прогресс ${Math.round(s * 100)}%, строка ${row}`
    }
  }
  console.log(`прогресс ${String(Math.round(s * 100)).padStart(3)}% — скролл ${y}`)
}

const strip = files.map((f, i) => ({ input: f, top: Math.round((i * H * 640) / W) + i * 4, left: 0 }))
await sharp({
  create: {
    width: 640,
    height: Math.round((H * 640) / W) * files.length + 4 * (files.length - 1),
    channels: 3,
    background: '#16130f',
  },
})
  .composite(strip)
  .toFile(`${OUT}/8-junction.png`)

console.log(`\nсамая заметная ступень: ${worst.toFixed(1)} уровня — ${worstAt}`)
console.log(worst > 6 ? 'ШОВ ЕСТЬ' : 'шва нет')
await b.close()
