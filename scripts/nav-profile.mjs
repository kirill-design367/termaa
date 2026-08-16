/**
 * Профиль земли под шапкой: до какой абсциссы белый пункт держит 4.5:1.
 *
 * Приговор в `contrast.mjs` выносится по МЕДИАНЕ прямоугольника пункта,
 * поэтому и здесь считается медиана скользящего окна шириной с пункт.
 * Итог — предельная правая кромка меню; ширина `.hdr__nav` ставится по
 * ней, а не на глаз.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'

const URL = process.env.U || 'http://127.0.0.1:8099/termaa/'
const W = +(process.env.W || 1920)
const H = +(process.env.H || 1080)

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await p.goto(URL, { waitUntil: 'networkidle' })
await p.waitForTimeout(2200)

const geo = await p.evaluate(() => {
  const links = [...document.querySelectorAll('.hdr__link')]
  const nav = document.querySelector('.hdr__nav')
  return {
    nav: nav ? [...['x', 'y', 'width', 'height'].map((k) => nav.getBoundingClientRect()[k])] : null,
    links: links.map((el) => {
      const r = el.getBoundingClientRect()
      return { t: el.textContent.trim(), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    }),
  }
})
console.log('меню', geo.nav && geo.nav.map((v) => Math.round(v)).join(' · '))
for (const l of geo.links) console.log(`  ${l.t.padEnd(12)} x ${l.x}…${l.x + l.w}  ш ${l.w}`)

await p.addStyleTag({ content: `.hdr__link { visibility: hidden !important }` })
await p.waitForTimeout(120)
const { data, info } = await sharp(await p.screenshot())
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = (r, g, bl) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(bl / 255)
const ratio = (a, z) => (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05)

const box = geo.links[geo.links.length - 1]
const med = (x0, w) => {
  const v = []
  for (let y = box.y; y < box.y + box.h; y += 2)
    for (let x = x0; x < x0 + w; x += 2) {
      if (x < 0 || x >= info.width) continue
      const i = (info.width * y + x) << 2
      v.push(lum(data[i], data[i + 1], data[i + 2]))
    }
  v.sort((a, z) => a - z)
  return v[v.length >> 1]
}

console.log(`\nокно шириной с «${box.t}» (${box.w} px), белые чернила:`)
let limit = null
for (let x = 0; x + box.w <= W; x += 20) {
  const r = ratio(1, med(x, box.w))
  if (r >= 4.5) limit = x + box.w
  if (x % 100 === 0) console.log(`  правая кромка ${String(x + box.w).padStart(4)} px (${((x + box.w) / W).toFixed(3)} ш) → ${r.toFixed(2)}:1`)
}
console.log(`\nпредельная правая кромка пункта: ${limit} px = ${(limit / W).toFixed(3)} ширины`)
await b.close()
