/**
 * Три кадра входа.
 *
 * Момент задаётся установкой таймлайна (`?shot=1`), а не таймером:
 * таймер даёт разброс в десятки миллисекунд, и кадры оказываются
 * несопоставимыми между прогонами.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'

const OUT = process.env.OUT || '/workspace/shots/rep'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await p.goto('http://127.0.0.1:8099/termaa/?shot=1', { waitUntil: 'domcontentloaded' })
await p.waitForFunction(() => !!window.__intro, null, { timeout: 90000 })
// Возвращать сам таймлайн нельзя: Playwright сериализует результат
// evaluate, а у таймлайна GSAP циклические ссылки — вызов зависает
// намертво. Возвращаем ничего.
await p.evaluate(() => {
  window.__intro.pause()
})
console.log('длительность входа', await p.evaluate(() => window.__intro.duration()), 'с')

const files = []
for (const t of [0.3, 1.15, 1.8]) {
  await p.evaluate((v) => {
    window.__intro.seek(v)
  }, t)
  await p.waitForTimeout(400)
  const f = `${OUT}/_in-${t}.png`
  await sharp(await p.screenshot()).resize(820).toFile(f)
  files.push(f)
  console.log('снят кадр', t, 'с')
}

const m = await sharp(files[0]).metadata()
await sharp({
  create: { width: m.width, height: m.height * 3 + 12, channels: 3, background: '#16130f' },
})
  .composite(files.map((f, i) => ({ input: f, top: i * (m.height + 6), left: 0 })))
  .toFile(`${OUT}/6-intro.png`)
console.log('полоса собрана')
await b.close()
