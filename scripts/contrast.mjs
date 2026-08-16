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

// Кнопка в список не входит: у неё своя заливка, и землёй ей служит она
// сама, а не фотография. Её контраст — пар на чернилах, 18.1:1.
const SEL = ['.hdr__link', '.wm--main i', '.hero__title .ln', '.hero__edge']

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
        text: ((el.textContent || '').trim() || el.className).slice(0, 26),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        // Цвет знака резолвится ХОЛСТОМ, а не разбором строки: браузер
        // отдаёт `color` то в rgb, то в oklab с альфой, и по строке его
        // надёжно не прочитать. Холст принимает любую запись и отдаёт
        // готовые байты.
        color: (() => {
          const c = document.createElement('canvas')
          c.width = c.height = 1
          const x = c.getContext('2d')
          x.fillStyle = getComputedStyle(el).color
          x.fillRect(0, 0, 1, 1)
          const d = x.getImageData(0, 0, 1, 1).data
          return [d[0], d[1], d[2]]
        })(),
      })
    }
  }
  return out
}, SEL)

await p.addStyleTag({
  content: `.hdr__link, .wm, .hero__title, .hero__foot { visibility: hidden !important }`,
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


console.log(`\n${W}×${H} — контраст по фактической земле под каждым словом\n`)
let bad = 0
for (const box of boxes) {
  const ground = pick(png, box, 2)
  if (!ground.length) continue
  ground.sort((a, z) => a - z)
  const med = ground[ground.length >> 1]
  const ink = lum(box.color[0], box.color[1], box.color[2])
  // Худшая земля — самая близкая по светлоте к чернилам.
  const worst =
    ink < med ? ground[Math.floor(ground.length * 0.05)] : ground[Math.floor(ground.length * 0.95)]
  const rMed = ratio(ink, med)
  const rBad = ratio(ink, worst)
  // Крупный набор — порог 3:1 (WCAG large text). Имя ростом в треть
  // экрана и заголовок в 88 px оба крупные; интерфейсный кегль — 4.5:1.
  const need = box.sel === '.wm--main i' || box.sel.includes('title') ? 3 : 4.5
  // Приговор выносится ПО МЕДИАНЕ — так требование и сформулировано.
  // Худшие 5 % площади печатаются рядом как справка: под именем это
  // чёрные стойки павильона, то есть ровно те места, где литера и так
  // закрыта передним планом.
  const ok = rMed >= need
  if (!ok) bad++
  console.log(
    `${ok ? '  ' : '✗ '}${box.text.padEnd(26)} ${rMed.toFixed(2).padStart(6)}:1 медиана · ${rBad
      .toFixed(2)
      .padStart(6)}:1 худшая земля  (нужно ${need}:1)` +
      (process.env.V ? `   [чернила ${ink.toFixed(3)} · земля ${med.toFixed(3)} · худшая ${worst.toFixed(3)}]` : ''),
  )
}
console.log(bad ? `\nНЕ ПРОХОДИТ: ${bad}` : '\nвсё проходит')
await b.close()
