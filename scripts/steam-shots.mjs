/**
 * Три кадра приёма с паром под курсором: пар цел, пар разошёлся,
 * пар затягивается обратно. Плюс кадры витрины /fonts.
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const BASE = process.argv[2] || 'http://127.0.0.1:8099/termaa/'
const OUT = '/workspace/shots'
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
})
const page = await ctx.newPage()
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(3400)

// 1 — пар цел, курсор ещё не заходил в кадр
await page.screenshot({ path: `${OUT}/steam-1-целый.png` })

// 2 — курсор внутри, пар разошёлся и открыл воду с камнем
for (let i = 0; i < 26; i++) {
  await page.mouse.move(560 + i * 14, 880 - Math.sin(i / 6) * 60)
  await page.waitForTimeout(26)
}
await page.waitForTimeout(420)
await page.screenshot({ path: `${OUT}/steam-2-разошёлся.png` })

// 3 — курсор ушёл, пар затягивается обратно (снимок в середине 1.2 с)
await page.mouse.move(960, -10)
await page.waitForTimeout(430)
await page.screenshot({ path: `${OUT}/steam-3-затягивается.png` })

// ── Витрина шрифтов ──────────────────────────────────────────────────
await page.goto(BASE + 'fonts/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1400)
const stills = await page.$$('.still')
for (let i = 0; i < stills.length; i++) {
  await stills[i].scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await stills[i].screenshot({ path: `${OUT}/fonts-para-${i + 1}.png` })
}
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/fonts-верх.png`, fullPage: false })

await browser.close()
console.log('готово')
