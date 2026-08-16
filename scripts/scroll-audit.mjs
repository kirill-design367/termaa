/**
 * Расслоение кадра на скролле: ищем участки, которые едут не так, как
 * весь остальной снимок.
 *
 * Раньше в герое лежали ТРИ слоя одной и той же фотографии — снимок,
 * холст воды и копия под маской переднего плана, — и мастер-таймлайн
 * вёл масштабом только первый. Копии оставались на месте, и по кадру
 * шёл разрыв. Проверка устроена так, чтобы поймать именно это, а не
 * «на глаз».
 *
 * Кадр бьётся на плитки. Для каждой плитки перебором ищется сдвиг,
 * при котором она лучше всего ложится на следующий кадр скролла. Если
 * фотография едет целиком, все сдвиги обязаны лечь на одну модель
 * подобия — общий сдвиг плюс масштаб от центра. Расслоение — это
 * плитки, которые в модель не укладываются: одни поехали, другие нет.
 * Печатается остаток по модели, в пикселях.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'

const URL = process.env.U || 'http://127.0.0.1:8099/termaa/'
const W = 1920
const H = 1080
/** Плитка и окно поиска. Окно шире максимального ожидаемого сдвига. */
const T = 120
const R = 14
/** Точки скролла внутри сцены героя, в долях её длины. */
const AT = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85]

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await p.goto(URL, { waitUntil: 'networkidle' })
await p.waitForTimeout(2400)
/* Из замера снимается всё, что не фотография.

   Набор — потому что он и обязан уходить своим темпом, это композиция,
   а не расслоение. Перекрёстное гашение со следующей сценой — потому
   что при смешении двух разных картинок сопоставление плиток находит
   сдвиги там, где никто никуда не ехал. `!important` перебивает
   строчные стили, которые пишет GSAP, поэтому замер идёт по всей длине
   сцены, а не только до начала растворения. */
await p.addStyleTag({
  content: `.wm, .hero__title, .hero__foot, .hdr, .fab { visibility: hidden !important }
            .hero__bg { opacity: 1 !important }
            .sc-next { opacity: 0 !important }`,
})
await p.waitForTimeout(200)

const heroLen = await p.evaluate(() => {
  const el = document.querySelector('.hero')
  return el.getBoundingClientRect().height - window.innerHeight
})

const grey = async (y) => {
  await p.evaluate((v) => window.scrollTo(0, v), y)
  await p.waitForTimeout(650)
  const r = await sharp(await p.screenshot())
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return r
}

/** Сумма модулей разностей плитки при сдвиге (dx, dy). */
const sad = (a, z, x0, y0, dx, dy) => {
  let s = 0
  for (let y = y0; y < y0 + T; y += 3)
    for (let x = x0; x < x0 + T; x += 3) {
      const j = (y + dy) * W + (x + dx)
      s += Math.abs(a.data[y * W + x] - z.data[j])
    }
  return s
}

console.log('расслоение кадра на скролле — остаток по модели подобия\n')
let worst = 0
for (const f of AT) {
  const y0 = Math.round(heroLen * f)
  const a = await grey(y0)
  const z = await grey(y0 + 60)

  const pts = []
  for (let ty = R + 40; ty + T + R < H - 40; ty += T)
    for (let tx = R; tx + T + R < W; tx += T) {
      // Плитка без фактуры сдвиг не определяет — пропускаем.
      let lo = 255
      let hi = 0
      for (let y = ty; y < ty + T; y += 4)
        for (let x = tx; x < tx + T; x += 4) {
          const v = a.data[y * W + x]
          if (v < lo) lo = v
          if (v > hi) hi = v
        }
      if (hi - lo < 26) continue

      let best = Infinity
      let bdx = 0
      let bdy = 0
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const s = sad(a, z, tx, ty, dx, dy)
          if (s < best) {
            best = s
            bdx = dx
            bdy = dy
          }
        }
      pts.push({ x: tx + T / 2, y: ty + T / 2, dx: bdx, dy: bdy })
    }

  // Модель подобия: d = c + s * (p - центр). Три неизвестных, МНК.
  const cx = W / 2
  const cy = H / 2
  let sxx = 0
  let sxd = 0
  let n = pts.length
  let mdx = 0
  let mdy = 0
  for (const q of pts) {
    mdx += q.dx
    mdy += q.dy
    sxx += (q.x - cx) ** 2 + (q.y - cy) ** 2
    sxd += (q.x - cx) * q.dx + (q.y - cy) * q.dy
  }
  mdx /= n
  mdy /= n
  const s = sxx ? sxd / sxx : 0
  let res = 0
  let mx = 0
  for (const q of pts) {
    const ex = mdx + s * (q.x - cx) - q.dx
    const ey = mdy + s * (q.y - cy) - q.dy
    const e = Math.hypot(ex, ey)
    res += e
    if (e > mx) mx = e
  }
  res /= n
  if (mx > worst) worst = mx
  console.log(
    `скролл ${String(y0).padStart(4)} → ${y0 + 60}: плиток ${String(n).padStart(3)} · общий сдвиг ${mdx.toFixed(1)},${mdy.toFixed(1)} px · масштаб ${(s * 1e3).toFixed(2)}‰ · остаток средн ${res.toFixed(2)} px, макс ${mx.toFixed(1)} px`,
  )
}
console.log(
  worst <= 3
    ? `\nкадр едет целиком: ни одна плитка не отклонилась больше чем на ${worst.toFixed(1)} px`
    : `\nРАССЛОЕНИЕ: максимальное отклонение ${worst.toFixed(1)} px`,
)
await b.close()
