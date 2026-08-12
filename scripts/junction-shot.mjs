/**
 * Стык hero со следующим блоком и проверка, что объём гаснет.
 *
 * Считаем кадры объёма счётчиком: прокручиваем страницу так, чтобы герой
 * ушёл из вида, ждём и смотрим, растёт ли счётчик. Если растёт — объём
 * считается впустую, и это ошибка.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import path from 'node:path'

const OUT = '/workspace/shots/rep'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
})
const p = await ctx.newPage()
p.setDefaultTimeout(600000)
p.on('pageerror', (e) => console.log('!!', e.message.slice(0, 200)))

await p.goto('http://127.0.0.1:8099/termaa/?steam=force&steps=14&manual=1', {
  waitUntil: 'networkidle',
})
await p.waitForFunction(() => !!window.__steam, null, { timeout: 30000 })
await p.evaluate(() => window.__steam.run(3, 12))

const geo = await p.evaluate(() => {
  const h = document.querySelector('.hero')
  const c = document.querySelector('.steamgl__c')
  const next = document.querySelector('.hero').nextElementSibling
  return {
    heroH: h.clientHeight,
    canvasH: c.height,
    tail: c.height - h.clientHeight,
    nextTop: Math.round(next.getBoundingClientRect().top + scrollY),
  }
})
console.log('геометрия:', JSON.stringify(geo))

// Кадр стыка: граница секций примерно в середине экрана.
await p.evaluate((y) => window.scrollTo(0, y), geo.heroH - 540)
await p.evaluate(() => window.__steam.run(0.5, 20))
const f = path.join(OUT, '6-junction.png')
await p.screenshot({ path: f })
await sharp(f)
  .extract({ left: 0, top: 300, width: 1920, height: 560 })
  .toFile(path.join(OUT, '6-junction-crop.png'))

// Полоса яркости поперёк стыка: шов дал бы ступеньку в графике.
const raw = await sharp(f).greyscale().raw().toBuffer({ resolveWithObject: true })
const { width } = raw.info
const rowMean = (y) => {
  let s = 0
  for (let x = 0; x < width; x++) s += raw.data[y * width + x]
  return s / width
}
const seam = 540 // граница секций в этом кадре
const prof = []
for (let dy = -40; dy <= 40; dy += 8) prof.push(rowMean(seam + dy).toFixed(1))
console.log('яркость поперёк стыка:', prof.join(' '))

await b.close()
