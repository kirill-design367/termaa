/**
 * Крупный план: где архитектура режет литеры.
 *
 * Перекрытие сделано ВТОРОЙ КОПИЕЙ той же фотографии под испечённой
 * маской переднего плана. Чтобы это было видно, снимаются два кадра —
 * с передним планом и без него: во втором слово лежит поверх кадра
 * целиком, и разница показывает ровно те пиксели, которые архитектура
 * отбирает у литер.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'

const URL = process.env.U || 'http://127.0.0.1:8099/termaa/'
const OUT = process.env.OUT || '/workspace/shots/rep'
/** Правая половина слова: наклонная кромка крыши и стойки остекления. */
const CROP = { left: 980, top: 270, width: 920, height: 420 }

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await p.goto(`${URL}?water=off`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1800)

const on = `${OUT}/_ov-on.png`
await sharp(await p.screenshot()).extract(CROP).toFile(on)

await p.addStyleTag({ content: '.hero__fg { display: none !important }' })
await p.waitForTimeout(200)
const off = `${OUT}/_ov-off.png`
await sharp(await p.screenshot()).extract(CROP).toFile(off)

const px = async (f) => sharp(f).ensureAlpha().raw().toBuffer()
const [a, z] = await Promise.all([px(on), px(off)])
let n = 0
for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - z[i]) > 10) n++
console.log(
  `архитектура отбирает у литер ${n} пикселей — ${((n / (CROP.width * CROP.height)) * 100).toFixed(1)} % площади кадра`,
)

await sharp({
  create: { width: CROP.width, height: CROP.height * 2 + 6, channels: 3, background: '#16130f' },
})
  .composite([
    { input: on, top: 0, left: 0 },
    { input: off, top: CROP.height + 6, left: 0 },
  ])
  .toFile(`${OUT}/3-overlap.png`)
console.log('полоса собрана: сверху как в бою, снизу без переднего плана')
await b.close()
