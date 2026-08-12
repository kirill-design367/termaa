/**
 * Контраст текста в кадре героя — по фактическим пикселям, а не по токенам.
 *
 * Скрим и подложки из кадра убраны, значит землёй под каждым словом
 * служит сама фотография, и она под разными словами разная. Поэтому
 * считать надо не «цвет на цвете», а знак на том, что под ним реально
 * лежит: берём отрисованную страницу, снимаем прямоугольник под каждым
 * пунктом с ВЫКЛЮЧЕННЫМ текстом и считаем WCAG-отношение.
 *
 * Худший случай важнее среднего: если под одной литерой земля светлая,
 * пункт не читается целиком.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'

const URL = process.env.U || 'http://127.0.0.1:8099/termaa/'
const W = +(process.env.W || 1920)
const H = +(process.env.H || 1080)

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await p.goto(URL, { waitUntil: 'networkidle' })
await p.waitForTimeout(2600)

const SEL = ['.hdr__link', '.hero__title .ln > i', '.hero__hours', '.hero__tag', '.hero .btn']

// Геометрия снимается с текстом, а фон — без него: иначе в выборку
// попадут сами литеры и земля окажется «темнее», чем она есть.
const boxes = await p.evaluate((sels) => {
  const out = []
  for (const s of sels) {
    for (const el of document.querySelectorAll(s)) {
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) continue
      out.push({
        sel: s,
        text: (el.textContent || '').trim().slice(0, 26),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        color: getComputedStyle(el).color,
      })
    }
  }
  return out
}, SEL)

// Кадр со знаками — из него берём светлоту самих чернил.
const withText = await p.screenshot()
{
  const r = await sharp(withText).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  globalThis.shotWith = { width: r.info.width, height: r.info.height, data: r.data }
}

await p.addStyleTag({
  content: `.hdr__link, .hero__title, .hero__foot { visibility: hidden !important }`,
})
await p.waitForTimeout(150)
const shot = await p.screenshot()
const { data, info } = await sharp(shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const png = { width: info.width, height: info.height, data }

const pick = (src, b, step) => {
  const v = []
  for (let y = b.y; y < b.y + b.h; y += step)
    for (let x = b.x; x < b.x + b.w; x += step) {
      if (x < 0 || y < 0 || x >= src.width || y >= src.height) continue
      const i = (src.width * y + x) << 2
      v.push(lum(src.data[i], src.data[i + 1], src.data[i + 2]))
    }
  return v
}

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = (r, g, bl) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(bl / 255)
const ratio = (a, z) => (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05)

/**
 * Светлота знака берётся не из `color`, а с отрисованного кадра.
 *
 * Вычисленный цвет уже не разобрать надёжно: браузер отдаёт его в
 * oklab и с альфой, а прозрачные чернила подмешивают землю. Снимаем
 * крайний по светлоте пиксель внутри слова — это и есть то, что видит
 * глаз после всех смешений и сглаживания.
 */
const inkFrom = (px, groundMed) => {
  px.sort((a, z) => a - z)
  const lo = px[Math.floor(px.length * 0.02)]
  const hi = px[Math.floor(px.length * 0.98)]
  // Чернила — то, что дальше всего от земли: между литерами в рамке
  // видна сама земля, и по одной только светлоте их не различить.
  return Math.abs(lo - groundMed) > Math.abs(hi - groundMed) ? lo : hi
}

console.log(`\n${W}×${H} — контраст по фактической земле под каждым словом\n`)
let bad = 0
for (const box of boxes) {
  const ground = pick(png, box, 2)
  const inked = pick(shotWith, box, 1)
  if (!ground.length || !inked.length) continue
  ground.sort((a, z) => a - z)
  const med = ground[ground.length >> 1]
  const ink = inkFrom(inked, med)
  // Худшая земля — самая близкая по светлоте к чернилам.
  const worst =
    ink < med ? ground[Math.floor(ground.length * 0.05)] : ground[Math.floor(ground.length * 0.95)]
  const rMed = ratio(ink, med)
  const rBad = ratio(ink, worst)
  const need = box.sel.includes('title') ? 3 : 4.5
  const ok = rBad >= need
  if (!ok) bad++
  console.log(
    `${ok ? '  ' : '✗ '}${box.text.padEnd(26)} ${rMed.toFixed(2).padStart(6)}:1 медиана · ${rBad
      .toFixed(2)
      .padStart(6)}:1 худшая земля  (нужно ${need}:1)`,
  )
}
console.log(bad ? `\nНЕ ПРОХОДИТ: ${bad}` : '\nвсё проходит')
await b.close()
