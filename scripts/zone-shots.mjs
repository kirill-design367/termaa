/**
 * Четыре зоны с фонами и проверка стыка «конец героя → начало Комплекса».
 *
 * Зоны сняты через прогресс пина: прокручиваем ровно в середину каждой
 * зоны, когда проём уже прошёл и затемнение вернулось на 60 %.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import path from 'node:path'

const OUT = '/workspace/shots/rep'
const W = 1920
const H = 1080

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
})
const p = await ctx.newPage()
p.setDefaultTimeout(600000)
p.on('pageerror', (e) => console.log('!!', e.message.slice(0, 200)))

await p.goto('http://127.0.0.1:8099/termaa/?steam=off', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)

const geo = await p.evaluate(() => {
  // offsetTop считается от позиционированного предка и здесь врёт:
  // берём положение относительно документа.
  const top = (el) => Math.round(el.getBoundingClientRect().top + window.scrollY)
  const hero = document.querySelector('.hero')
  const zones = document.querySelector('.zones')
  return {
    heroTop: top(hero),
    heroH: hero.offsetHeight,
    zonesTop: top(zones),
    zonesH: zones.offsetHeight,
    vh: window.innerHeight,
    страница: document.body.scrollHeight,
  }
})
console.log('геометрия:', JSON.stringify(geo))

// ── Стык: конец героя и начало «Комплекса» ──────────────────────────
const heroEnd = geo.heroTop + geo.heroH - geo.vh
const junction = [
  ['a-конец-героя', heroEnd - Math.round(geo.vh * 0.5)],
  ['b-герой-отработал', heroEnd],
  ['c-комплекс-входит', heroEnd + Math.round(geo.vh * 0.35)],
  ['d-комплекс', heroEnd + Math.round(geo.vh * 0.9)],
]
const tiles = []
const tw = 480
const th = Math.round((tw / W) * H)
for (const [name, y] of junction) {
  await p.evaluate((v) => window.scrollTo(0, v), Math.max(0, y))
  await p.waitForTimeout(900)
  const f = path.join(OUT, `j-${name}.png`)
  await p.screenshot({ path: f })
  const t = f.replace('.png', '-t.png')
  await sharp(f).resize({ width: tw }).toFile(t)
  tiles.push({ input: t, left: tiles.length * tw, top: 0 })
}
await sharp({ create: { width: tw * 4, height: th, channels: 3, background: '#16130f' } })
  .composite(tiles)
  .png()
  .toFile(path.join(OUT, '4-junction-strip.png'))

// ── Четыре зоны ─────────────────────────────────────────────────────
// Пин держит секцию на (ZONES-1) экранов сверх её высоты.
const zoneShots = []
for (let i = 0; i < 4; i++) {
  // Пин держит секцию ещё (зон − 1) экранов сверх её высоты. Смена
  // происходит на границах экранов, поэтому устоявшееся состояние i-й
  // зоны — это конец её экрана, а не середина.
  const y = geo.zonesTop + Math.round(geo.vh * (i === 0 ? 0.05 : i - 0.05))
  await p.evaluate((v) => window.scrollTo(0, v), y)
  await p.waitForTimeout(1100)
  const f = path.join(OUT, `5-zone-${i + 1}.png`)
  await p.screenshot({ path: f })
  zoneShots.push(f)
  const name = await p.evaluate(() => {
    // Уходящая зона намеренно не гаснет — её накрывает следующая.
    // Значит видимая сверху это ПОСЛЕДНЯЯ проявленная, а не первая.
    let best = null
    for (const z of document.querySelectorAll('.zone')) {
      const cs = getComputedStyle(z)
      if (cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.5) best = z
    }
    const img = best.querySelector('.zone__img img')
    return {
      зона: best.querySelector('.zone__name')?.textContent,
      кадр: (img?.currentSrc || img?.src || '').split('/').pop(),
      затемнение: getComputedStyle(best.querySelector('.zone__scrim')).opacity,
    }
  })
  console.log(`зона ${i + 1}:`, JSON.stringify(name))
}

// Полоса из четырёх зон.
const zt = []
for (const [i, f] of zoneShots.entries()) {
  const t = f.replace('.png', '-t.png')
  await sharp(f).resize({ width: tw }).toFile(t)
  zt.push({ input: t, left: i * tw, top: 0 })
}
await sharp({ create: { width: tw * 4, height: th, channels: 3, background: '#16130f' } })
  .composite(zt)
  .png()
  .toFile(path.join(OUT, '5-zones-strip.png'))

await b.close()
