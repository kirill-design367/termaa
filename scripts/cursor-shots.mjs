/**
 * Три фазы реакции пара на курсор, снятые по модельному времени.
 *
 * Здесь важно не реальное время, а время симуляции: контейнер рендерит
 * кадр программно, секунда экрана растягивается на минуту, и «+0.2 с»
 * иначе не снять. Хук ?manual=1 крутит те же 1/60 с шагами, что и в бою.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import path from 'node:path'

const OUT = '/workspace/shots/rep'
const W = 1920
const H = 1080
const BOX = { left: 420, top: 190, width: 900, height: 520 }

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({
  viewport: { width: W, height: H },
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

const shot = async (name) => {
  const f = path.join(OUT, name)
  await p.screenshot({ path: f })
  await sharp(f).extract(BOX).toFile(f.replace('.png', '-crop.png'))
}

// Успокоенное состояние — фон, с которым сравниваем.
await p.evaluate(() => window.__steam.run(3, 12))
await shot('4-0-rest.png')

// Движение: курсор идёт слева направо, шаг за шагом, как настоящая мышь.
await p.evaluate(() => {
  for (let i = 0; i <= 20; i++) {
    window.__steam.point(620 + i * 14, 440 + Math.sin(i / 4) * 26)
    window.__steam.run(1 / 60)
  }
})
await shot('4a-move.png')

// Курсор остановился и ушёл: смотрим, как возмущение живёт и гаснет.
await p.evaluate(() => window.__steam.leave())
await p.evaluate(() => window.__steam.run(0.2))
await shot('4b-plus200.png')
await p.evaluate(() => window.__steam.run(0.3))
await shot('4c-plus500.png')
await p.evaluate(() => window.__steam.run(0.5))
await shot('4d-plus1000.png')

await b.close()
console.log('готово')
