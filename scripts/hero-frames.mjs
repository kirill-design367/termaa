/** Кадр героя в бою: десктоп и мобильная, для отчёта. */
import { chromium } from 'playwright'
import sharp from 'sharp'
const OUT = process.env.OUT || '/workspace/shots/rep'
const U = process.env.U || 'http://127.0.0.1:8099/termaa/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [w, h, dpr, name] of [[1920, 1080, 1, '1-hero-desktop'], [390, 844, 2, '1-hero-mobile']]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr })
  await p.goto(U, { waitUntil: 'networkidle' })
  await p.waitForTimeout(2800)
  await sharp(await p.screenshot()).toFile(`${OUT}/${name}.png`)
  console.log(name, w + '×' + h)
  await p.close()
}
await b.close()
