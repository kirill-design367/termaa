/**
 * Схема композиции: золотые линии и что на них стоит.
 *
 * Линии не рисуются на глаз — они берутся из тех же переменных, что
 * держат раскладку (`--phi-x`, `--phi-y`, `--wm-base`), а рамки
 * элементов снимаются с живой страницы. Схема и кадр не могут разойтись.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'

const URL = process.env.U || 'http://127.0.0.1:8099/termaa/'
const OUT = process.env.OUT || '/workspace/shots/rep'
const W = +(process.env.W || 1920)
const H = +(process.env.H || 1080)

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await p.goto(`${URL}?water=off`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1800)
const shot = await p.screenshot()

const g = await p.evaluate(() => {
  const r = (s) => {
    const e = document.querySelector(s)
    if (!e) return null
    const b = e.getBoundingClientRect()
    return [b.x, b.y, b.width, b.height]
  }
  const cs = getComputedStyle(document.querySelector('.hero__stage'))
  const n = (k) => parseFloat(cs.getPropertyValue(k))
  const wm = [...document.querySelectorAll('.wm i')].filter((e) => e.textContent.trim())
  const f = wm[0].getBoundingClientRect()
  const l = wm[wm.length - 1].getBoundingClientRect()
  return {
    phiX: n('--phi-x'),
    phiY: n('--phi-y'),
    base: n('--wm-base'),
    wm: [f.x, f.y, l.right - f.x, f.height],
    cta: r('.hero__cta'),
    title: r('.hero__title'),
    nav: r('.hdr__nav'),
    edgeL: r('.hero__edge--l'),
    edgeR: r('.hero__edge--r'),
  }
})
await b.close()

/* Подпись садится под рамку, если над ней нет места: схема должна
   читаться, а не показывать, как надписи налезают друг на друга. */
const box = (b, t, below) =>
  b
    ? `<rect x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="7 6" opacity=".85"/>
       <text x="${b[0]}" y="${below || b[1] < 30 ? b[1] + b[3] + 20 : b[1] - 8}" fill="#fff" font-family="monospace" font-size="17">${t}</text>`
    : ''

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect x="0" y="0" width="${W}" height="${H}" fill="#000" opacity=".34"/>
  <line x1="${g.phiX}" y1="0" x2="${g.phiX}" y2="${H}" stroke="#ff8a00" stroke-width="2"/>
  <line x1="0" y1="${g.phiY}" x2="${W}" y2="${g.phiY}" stroke="#ff8a00" stroke-width="2"/>
  <circle cx="${g.phiX}" cy="${g.phiY}" r="11" fill="none" stroke="#ff8a00" stroke-width="3"/>
  <text x="${g.phiX + 18}" y="26" fill="#ff8a00" font-family="monospace" font-size="19">вертикаль φ — 0.618 ширины (${Math.round(g.phiX)} px)</text>
  <text x="14" y="${g.phiY - 12}" fill="#ff8a00" font-family="monospace" font-size="19">горизонталь φ — 0.618 высоты (${Math.round(g.phiY)} px) = базовая линия TERMA</text>
  <text x="${g.phiX + 18}" y="${g.phiY + 30}" fill="#ff8a00" font-family="monospace" font-size="19">пересечение — угол кнопки</text>
  <line x1="${W * 0.03}" y1="0" x2="${W * 0.03}" y2="${H}" stroke="#7fd4ff" stroke-width="1" stroke-dasharray="4 8"/>
  <line x1="${W * 0.97}" y1="0" x2="${W * 0.97}" y2="${H}" stroke="#7fd4ff" stroke-width="1" stroke-dasharray="4 8"/>
  <text x="${W * 0.03 + 10}" y="${H * 0.86}" fill="#7fd4ff" font-family="monospace" font-size="17">поле 3 %</text>
  ${box(g.nav, 'меню — в тёмной зоне, до 0.38 ширины')}
  ${box(g.title, 'заголовок — левая половина, кегль имени ÷ 6', true)}
  ${box(g.wm, 'TERMA — во всю ширину, литера 32.5 % высоты')}
  ${box(g.cta, 'кнопка')}
  ${box(g.edgeL, 'режим')}
  ${box(g.edgeR, 'адрес')}
</svg>`

await sharp(shot)
  .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
  .toFile(`${OUT}/2-scheme.png`)
console.log(
  `схема собрана · φx ${Math.round(g.phiX)} · φy ${Math.round(g.phiY)} · базовая ${Math.round(g.base)} · слово ${Math.round(g.wm[2])} px при кадре ${W}`,
)
