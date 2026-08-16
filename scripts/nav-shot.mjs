/** Навигация в пилюлях: покой и наведение одним кадром. */
import { chromium } from 'playwright'
import sharp from 'sharp'
const OUT = process.env.OUT || '/workspace/shots/rep'
const CROP = { left: 40, top: 0, width: 760, height: 78 }
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 })
await p.goto('http://127.0.0.1:8099/termaa/', { waitUntil: 'networkidle' })
await p.waitForTimeout(2600)
const c2 = { left: CROP.left * 2, top: CROP.top * 2, width: CROP.width * 2, height: CROP.height * 2 }
const rest = `${OUT}/_nav-rest.png`
await sharp(await p.screenshot()).extract(c2).toFile(rest)
await p.hover('.hdr__link:nth-child(2)')
await p.waitForTimeout(600)
const hov = `${OUT}/_nav-hover.png`
await sharp(await p.screenshot()).extract(c2).toFile(hov)
await sharp({ create: { width: c2.width, height: c2.height * 2 + 8, channels: 3, background: '#16130f' } })
  .composite([{ input: rest, top: 0, left: 0 }, { input: hov, top: c2.height + 8, left: 0 }])
  .toFile(`${OUT}/4-nav.png`)
console.log('снято: сверху покой, снизу наведение на «Визит»')
await b.close()
