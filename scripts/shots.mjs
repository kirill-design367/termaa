/**
 * Снимает кадры сайта и меряет фактический fps по блокам.
 * Запуск: node scripts/shots.mjs [base] [outdir]
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const BASE = process.argv[2] || 'http://127.0.0.1:8099/termaa/'
const OUT = process.argv[3] || '/workspace/shots'
const EXEC = '/opt/pw-browsers/chromium'

const VIEWS = [
  { id: 'desk', w: 1920, h: 1080, dsf: 1 },
  { id: 'mob', w: 390, h: 844, dsf: 2, mobile: true },
]

/** Куда прокручивать, чтобы кадр блока был целиком в поле зрения. */
const STOPS = [
  { id: '1-hero', vh: 0 },
  { id: '2-kompleks', sel: '#kompleks', extra: 0.02 },
  { id: '3-kompleks', sel: '#kompleks', extra: 1.05 },
  { id: '4-kompleks', sel: '#kompleks', extra: 2.2 },
  { id: '5-vizit', sel: '#vizit', extra: 0.02 },
  { id: '6-vizit', sel: '#vizit', extra: 2.35 },
  { id: '7-vizit', sel: '#vizit', extra: 3.2 },
  { id: '8-tseny', sel: '#tseny', extra: 0.3 },
  { id: '9-otzyvy', sel: '.revs', extra: 0.45 },
  { id: '10-voprosy', sel: '.faq', extra: 0.16 },
  { id: '11-kontakty', sel: '#kontakty', extra: 0.24 },
  { id: '12-zapis', sel: '#zapis', extra: 0.18 },
]

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: EXEC, args: ['--force-device-scale-factor=1'] })

for (const v of VIEWS) {
  const ctx = await browser.newContext({
    viewport: { width: v.w, height: v.h },
    deviceScaleFactor: v.dsf,
    isMobile: !!v.mobile,
    hasTouch: !!v.mobile,
    reducedMotion: 'no-preference',
  })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && console.log('  ! console:', m.text()))
  page.on('pageerror', (e) => console.log('  !! pageerror:', e.message))
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3200) // входная анимация 2.2–2.5 с

  for (const s of STOPS) {
    if (s.vh !== undefined) {
      await page.evaluate((y) => window.scrollTo(0, y), s.vh)
    } else {
      await page.evaluate(
        ([sel, extra]) => {
          const el = document.querySelector(sel)
          const top = el.getBoundingClientRect().top + window.scrollY
          window.scrollTo(0, top + window.innerHeight * extra)
        },
        [s.sel, s.extra],
      )
    }
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${OUT}/${v.id}-${s.id}.png` })
  }
  await ctx.close()
}

await browser.close()
console.log('кадры →', OUT)
