/**
 * Кадры и замеры объёмного пара.
 * Запуск: node scripts/steam-shots.mjs [base]
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const BASE = process.argv[2] || 'http://127.0.0.1:8099/termaa/'
// Число шагов марша можно снизить для съёмки: контейнер без GPU
// считает объём процессором и на боевых 28 шагах даёт единицы кадров.
const STEPS = process.argv[3] || ''
const OUT = '/workspace/shots/steam'
await mkdir(OUT, { recursive: true })

const PROBE = `
window.__fps = () => new Promise(res => {
  const t = []; let last = performance.now(); let raf
  const tick = n => { t.push(n - last); last = n; raf = requestAnimationFrame(tick) }
  raf = requestAnimationFrame(tick)
  window.__stop = () => {
    cancelAnimationFrame(raf)
    const s = t.slice(4).sort((a,b)=>a-b)
    const avg = s.length ? 1000/(s.reduce((a,c)=>a+c,0)/s.length) : 0
    res({ fps:+avg.toFixed(1), p95:+(s[Math.floor(s.length*0.95)]||0).toFixed(1), n:s.length })
  }
})`

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
})
const page = await ctx.newPage()
await page.addInitScript(PROBE)
page.on('pageerror', (e) => console.log('!!', e.message.slice(0, 200)))
await page.goto(BASE + '?steam=force' + (STEPS ? `&steps=${STEPS}` : ''), { waitUntil: 'networkidle' })
await page.waitForTimeout(4200)

const shot = (name, clip) => page.screenshot({ path: `${OUT}/${name}.png`, ...(clip ? { clip } : {}) })

// ── 1. Покой: весь кадр, левая треть, правый край ────────────────────
await shot('01-покой-весь-кадр')
await shot('02-покой-левая-треть', { x: 0, y: 0, width: 640, height: 1080 })
await shot('03-покой-правый-край', { x: 1280, y: 0, width: 640, height: 1080 })

// ── 2. Глубина: клубы перед буквами и за ними ────────────────────────
await shot('04-глубина-вордмарк', { x: 0, y: 620, width: 1920, height: 460 })

// ── 3. Замер: покой ──────────────────────────────────────────────────
let run = page.evaluate('window.__fps()')
await page.waitForTimeout(2600)
await page.evaluate('window.__stop()')
const restFps = await run

// ── 4. Развод под курсором ───────────────────────────────────────────
// Курсор идёт слева направо через нижнюю треть — там, где стоит слово.
run = page.evaluate('window.__fps()')
for (let i = 0; i < 34; i++) {
  await page.mouse.move(420 + i * 32, 830 - Math.sin(i / 5) * 90)
  await page.waitForTimeout(Number(process.env.STEP_MS || 24))
}
await page.evaluate('window.__stop()')
const moveFps = await run
await shot('05-развод-курсор-в-движении')

// Момент остановки.
await page.waitForTimeout(60)
await shot('06-развод-момент-остановки')
await page.waitForTimeout(400)
await shot('07-развод-через-0.4с')
await page.waitForTimeout(600)
await shot('08-развод-через-1.0с')

// ── 5. Замер: быстрое движение ───────────────────────────────────────
run = page.evaluate('window.__fps()')
for (let i = 0; i < 40; i++) {
  await page.mouse.move(300 + (i % 2 ? 1300 : 300), 500 + (i % 3) * 180)
  await page.waitForTimeout(16)
}
await page.evaluate('window.__stop()')
const fastFps = await run

// ── 6. Что подставляется, когда объёма нет ───────────────────────────
const p2 = await ctx.newPage()
await p2.goto(BASE + '?steam=off', { waitUntil: 'networkidle' })
await p2.waitForTimeout(3600)
await p2.screenshot({ path: `${OUT}/09-запасной-испечённый.png` })
const glOff = await p2.evaluate(() => document.querySelector('.hero')?.getAttribute('data-gl'))

console.log('\nЗамеры (headless Chromium, программная растеризация SwiftShader):')
console.log('  покой                 ', restFps.fps, 'fps   p95 кадра', restFps.p95, 'мс')
console.log('  развод под курсором   ', moveFps.fps, 'fps   p95 кадра', moveFps.p95, 'мс')
console.log('  быстрое движение      ', fastFps.fps, 'fps   p95 кадра', fastFps.p95, 'мс')
console.log('  data-gl при ?steam=off:', glOff ?? 'нет — работает испечённый')

await browser.close()
