/**
 * Реакция воды на курсор: три кадра одной волны и проверка, что вне
 * воды курсор не делает ничего.
 *
 * Время в приёме замораживается через диагностический доступ
 * (`?water=1`). Без заморозки кадры несопоставимы: постоянная рябь идёт
 * всегда, и по снимку не отличить волну от неё. С заморозкой все три
 * кадра сняты при одном и том же состоянии ряби и отличаются ровно
 * возрастом волны.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'

const URL = process.env.U || 'http://127.0.0.1:8099/termaa/'
const OUT = process.env.OUT || '/workspace/shots/rep'
/* Кадр берётся там, где на воде лежат ТЁПЛЫЕ ОТСВЕТЫ павильона: именно
   их волна обязана ломать и сдвигать — это главный выигрыш нового кадра.
   Слева на воде отсветов нет, и там разлом виден куда хуже. */
const CROP = { left: 1180, top: 812, width: 720, height: 248 }
/** Точка над водой и точка заведомо вне её — небо над горами. */
const ON = [1520, 900]
const OFF = [700, 160]
/** Момент, на котором заморожена рябь. Любой, лишь бы один и тот же. */
const T = 4.0

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await p.goto(`${URL}?water=1`, { waitUntil: 'networkidle' })
await p.waitForTimeout(2800)

const raw = async () =>
  sharp(await p.screenshot()).extract(CROP).raw().toBuffer()

const diff = (x, y) => {
  let sum = 0
  let max = 0
  for (let i = 0; i < x.length; i += 3) {
    const v = Math.abs(x[i] - y[i])
    sum += v
    if (v > max) max = v
  }
  return { avg: +(sum / (x.length / 3)).toFixed(2), max }
}

// Покой: волны нет, рябь заморожена.
await p.evaluate((t) => {
  window.__water.clear()
  window.__water.freeze(t)
}, T)
await p.waitForTimeout(320)
const calm = await raw()

const files = []
for (const age of [0.25, 0.7, 1.3]) {
  await p.evaluate(
    ([x, y, t, a]) => {
      window.__water.poke(x, y, t - a)
      window.__water.freeze(t)
    },
    [...ON, T, age],
  )
  await p.waitForTimeout(320)
  const f = `${OUT}/_wv-${age}.png`
  await sharp(await p.screenshot()).extract(CROP).toFile(f)
  files.push(f)
  const d = diff(calm, await raw())
  console.log(`волна ${age} с: отличие от покоя — средн ${d.avg} уровня, макс ${d.max}`)
}

// Вне воды: событие не должно порождать ничего.
await p.evaluate((t) => {
  window.__water.clear()
  window.__water.freeze(t)
}, T)
await p.waitForTimeout(200)
await p.mouse.move(OFF[0], OFF[1])
await p.waitForTimeout(400)
const away = diff(calm, await raw())
console.log(`курсор вне воды: отличие от покоя — средн ${away.avg}, макс ${away.max}`)
console.log(away.max === 0 ? 'вне воды курсор не делает ничего' : 'ВНЕ ВОДЫ ЕСТЬ РЕАКЦИЯ')

await sharp({
  create: {
    width: CROP.width,
    height: CROP.height * files.length + 6 * (files.length - 1),
    channels: 3,
    background: '#16130f',
  },
})
  .composite(files.map((f, i) => ({ input: f, top: i * (CROP.height + 6), left: 0 })))
  .toFile(`${OUT}/4-water-cursor.png`)

await b.close()
