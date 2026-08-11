/**
 * Меряет фактический fps по блокам: прокручивает каждый блок
 * с постоянной скоростью и считает интервалы между кадрами.
 * Отдельно меряет вход страницы и приём с паром под курсором.
 */
import { chromium } from 'playwright'

const BASE = process.argv[2] || 'http://127.0.0.1:8099/termaa/'
const EXEC = '/opt/pw-browsers/chromium'

const BLOCKS = [
  ['Герой (покой + параллакс)', '#top', 0, 0],
  ['1 · Комплекс', '#kompleks', 0, 3.0],
  ['2 · Визит', '#vizit', 0, 3.3],
  ['3 · Цены', '#tseny', -0.6, 1.6],
  ['4 · Отзывы', '.revs', -0.6, 1.6],
  ['5 · Вопросы', '.faq', -0.6, 1.4],
  ['6 · Как добраться', '#kontakty', -0.6, 1.6],
  ['7 · Запись', '#zapis', -0.6, 1.4],
]

const probe = `
window.__fps = () => new Promise(res => {
  const t = []; let last = performance.now(); let raf
  const tick = now => { t.push(now - last); last = now; raf = requestAnimationFrame(tick) }
  raf = requestAnimationFrame(tick)
  window.__stop = () => {
    cancelAnimationFrame(raf)
    const s = t.slice(3).sort((a,b)=>a-b)
    const p = q => s[Math.min(s.length-1, Math.floor(s.length*q))] || 0
    res({ frames: s.length, avg: 1000/(s.reduce((a,b)=>a+b,0)/s.length),
          p95ms: +p(0.95).toFixed(1), worstMs: +(s[s.length-1]||0).toFixed(1),
          under50: s.filter(x=>x>20).length })
  }
})`

const browser = await chromium.launch({ executablePath: EXEC })
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
})
const page = await ctx.newPage()
await page.addInitScript(probe)

// ── Вход страницы ────────────────────────────────────────────────────
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
const intro = page.evaluate('window.__fps()')
await page.waitForTimeout(2600)
await page.evaluate('window.__stop()')
const introRes = await intro
console.log(row('Вход страницы (2.2 с)', introRes))

await page.waitForTimeout(600)

// ── Прокрутка каждого блока ──────────────────────────────────────────
for (const [name, sel, from, span] of BLOCKS) {
  await page.evaluate(
    ([s, f]) => {
      const el = document.querySelector(s)
      const top = el.getBoundingClientRect().top + window.scrollY
      window.scrollTo(0, Math.max(0, top + window.innerHeight * f))
    },
    [sel, from],
  )
  await page.waitForTimeout(900)

  const run = page.evaluate('window.__fps()')
  if (span > 0) {
    await page.evaluate(
      (s) => {
        const start = window.scrollY
        const dist = window.innerHeight * s
        const t0 = performance.now()
        return new Promise((done) => {
          const step = () => {
            const k = Math.min(1, (performance.now() - t0) / 2600)
            window.scrollTo(0, start + dist * k)
            k < 1 ? requestAnimationFrame(step) : done()
          }
          requestAnimationFrame(step)
        })
      },
      span,
    )
  } else {
    await page.waitForTimeout(2000)
  }
  await page.evaluate('window.__stop()')
  console.log(row(name, await run))
}

// ── Приём с паром под курсором ───────────────────────────────────────
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(900)
const steam = page.evaluate('window.__fps()')
for (let i = 0; i < 60; i++) {
  await page.mouse.move(300 + i * 22, 620 + Math.sin(i / 4) * 180)
  await page.waitForTimeout(28)
}
await page.evaluate('window.__stop()')
console.log(row('Пар под курсором (герой)', await steam))

function row(name, r) {
  return `${name.padEnd(30)} ${r.avg.toFixed(1).padStart(5)} fps   p95 кадра ${String(
    r.p95ms,
  ).padStart(5)} мс   худший ${String(r.worstMs).padStart(6)} мс   кадров >20 мс: ${r.under50}/${r.frames}`
}

await browser.close()
