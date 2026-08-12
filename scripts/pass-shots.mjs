/**
 * Кадры к отчёту по этому заходу.
 *
 * Всё, что можно поставить на конкретную миллисекунду — ставится, а не
 * ловится ожиданием: вход заголовка через `__intro`, потёк и стекло через
 * getAnimations, пар через ручной шаг `__steam`.
 */
import { chromium } from 'playwright'
import sharp from 'sharp'
import path from 'node:path'

const OUT = '/workspace/shots/rep'
const W = 1920
const H = 1080

const strip = async (files, out, tw = 620) => {
  const th = Math.round((tw / W) * H)
  const tiles = []
  for (const [i, f] of files.entries()) {
    const t = f.replace('.png', `-t${tw}.png`)
    await sharp(f).resize({ width: tw }).toFile(t)
    tiles.push({ input: t, left: i * tw, top: 0 })
  }
  await sharp({
    create: { width: tw * files.length, height: th, channels: 3, background: '#16130f' },
  })
    .composite(tiles)
    .png()
    .toFile(path.join(OUT, out))
}

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

// ── 4. Стекло на заголовке: три фазы входа ──────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: W, height: H }, reducedMotion: 'no-preference' })
  const p = await ctx.newPage()
  p.setDefaultTimeout(600000)
  await p.goto('http://127.0.0.1:8099/termaa/?steam=off&shot=1', { waitUntil: 'networkidle' })
  await p.waitForFunction(() => !!window.__intro, null, { timeout: 30000 })
  const files = []
  for (const t of [0.62, 0.95, 1.35]) {
    await p.evaluate((v) => {
      window.__intro.pause()
      window.__intro.time(v)
    }, t)
    await p.waitForTimeout(220)
    const f = path.join(OUT, `_glass-${Math.round(t * 100)}.png`)
    await p.screenshot({ path: f })
    await sharp(f).extract({ left: 130, top: 320, width: 900, height: 260 }).toFile(
      f.replace('.png', '-c.png'),
    )
    files.push(f.replace('.png', '-c.png'))
  }
  const tw = 700
  const tiles = []
  for (const [i, f] of files.entries()) {
    const t = f.replace('.png', `-r.png`)
    await sharp(f).resize({ width: tw }).toFile(t)
    tiles.push({ input: t, left: i * tw, top: 0 })
  }
  await sharp({ create: { width: tw * 3, height: Math.round((tw / 900) * 260), channels: 3, background: '#16130f' } })
    .composite(tiles)
    .png()
    .toFile(path.join(OUT, '4-glass-strip.png'))
  console.log('стекло на заголовке снято')
  await ctx.close()
}

// ── 5. Наведение на кнопку героя ────────────────────────────────────
{
  const ctx = await b.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    reducedMotion: 'no-preference',
  })
  const p = await ctx.newPage()
  p.setDefaultTimeout(600000)
  await p.goto('http://127.0.0.1:8099/termaa/?steam=off', { waitUntil: 'networkidle' })
  await p.waitForTimeout(3200)
  const btn = p.locator('.hero .btn').first()
  const box = await btn.boundingBox()
  const files = []
  // Три фазы: до наведения, середина прояснения, полностью чисто.
  for (const [i, ms] of [0, 200, 700].entries()) {
    if (i === 1) await btn.hover()
    if (i === 2) await p.waitForTimeout(500)
    if (i === 1) await p.waitForTimeout(ms)
    const f = path.join(OUT, `_btn-${i}.png`)
    await p.screenshot({ path: f })
    const c = f.replace('.png', '-c.png')
    await sharp(f)
      .extract({
        left: Math.round((box.x - 26) * 2),
        top: Math.round((box.y - 26) * 2),
        width: Math.round((box.width + 52) * 2),
        height: Math.round((box.height + 52) * 2),
      })
      .resize({ width: 620 })
      .toFile(c)
    files.push(c)
  }
  const tiles = files.map((f, i) => ({ input: f, left: i * 620, top: 0 }))
  const meta = await sharp(files[0]).metadata()
  await sharp({ create: { width: 620 * 3, height: meta.height, channels: 3, background: '#16130f' } })
    .composite(tiles)
    .png()
    .toFile(path.join(OUT, '5-btn-glass.png'))
  console.log('кнопка снята')
  await ctx.close()
}

// ── 6. Реакция пара на курсор ───────────────────────────────────────
{
  const run = async (withCursor) => {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, reducedMotion: 'no-preference' })
    const p = await ctx.newPage()
    p.setDefaultTimeout(900000)
    await p.goto('http://127.0.0.1:8099/termaa/?steam=force&steps=14&manual=1', {
      waitUntil: 'networkidle',
    })
    await p.waitForFunction(() => !!window.__steam, null, { timeout: 30000 })
    await p.evaluate(() => window.__steam.run(3, 12))
    await p.evaluate((on) => {
      for (let i = 0; i <= 20; i++) {
        if (on) window.__steam.point(640 + i * 16, 470 + Math.sin(i / 4) * 24)
        window.__steam.run(1 / 60)
      }
      window.__steam.leave()
    }, withCursor)
    const out = []
    for (const [name, wait] of [
      ['move', 0],
      ['p200', 0.2],
      ['p500', 0.3],
    ]) {
      if (wait) await p.evaluate((s) => window.__steam.run(s), wait)
      const f = path.join(OUT, `_cur-${withCursor ? 'on' : 'off'}-${name}.png`)
      await p.screenshot({ path: f })
      out.push(f)
    }
    await ctx.close()
    return out
  }
  const on = await run(true)
  const off = await run(false)

  const BOX = { left: 430, top: 220, width: 900, height: 520 }
  const shots = []
  const diffs = []
  for (const [i, f] of on.entries()) {
    const c = f.replace('.png', '-c.png')
    await sharp(f).extract(BOX).resize({ width: 640 }).toFile(c)
    shots.push(c)

    const A = await sharp(f).greyscale().raw().toBuffer({ resolveWithObject: true })
    const B = await sharp(off[i]).greyscale().raw().toBuffer()
    const { width, height } = A.info
    const d = Buffer.alloc(width * height)
    let sum = 0
    for (let k = 0; k < d.length; k++) {
      const v = Math.abs(A.data[k] - B[k])
      sum += v
      d[k] = Math.min(255, v * 14)
    }
    const df = f.replace('.png', '-d.png')
    await sharp(d, { raw: { width, height, channels: 1 } })
      .extract(BOX)
      .resize({ width: 640 })
      .png()
      .toFile(df)
    diffs.push(df)
    console.log(`курсор ${['движение', '+0.2 с', '+0.5 с'][i]}: средняя дельта ${(sum / d.length).toFixed(3)}`)
  }
  const th = Math.round((640 / BOX.width) * BOX.height)
  for (const [name, arr] of [['6-cursor.png', shots], ['6-cursor-diff.png', diffs]]) {
    await sharp({ create: { width: 640 * 3, height: th, channels: 3, background: '#16130f' } })
      .composite(arr.map((f, i) => ({ input: f, left: i * 640, top: 0 })))
      .png()
      .toFile(path.join(OUT, name))
  }
}

// ── 8. Переход из героя в «Комплекс» ────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: W, height: H }, reducedMotion: 'no-preference' })
  const p = await ctx.newPage()
  p.setDefaultTimeout(600000)
  await p.goto('http://127.0.0.1:8099/termaa/?steam=off', { waitUntil: 'networkidle' })
  await p.waitForTimeout(2500)
  const g = await p.evaluate(() => {
    const h = document.querySelector('.hero')
    return {
      end: Math.round(h.getBoundingClientRect().top + scrollY + h.offsetHeight - innerHeight),
      vh: innerHeight,
    }
  })
  const files = []
  for (const [i, k] of [-0.55, -0.12, 0.3].entries()) {
    await p.evaluate((v) => window.scrollTo(0, Math.max(0, v)), g.end + Math.round(g.vh * k))
    await p.waitForTimeout(950)
    const f = path.join(OUT, `_hand-${i}.png`)
    await p.screenshot({ path: f })
    files.push(f)
  }
  await strip(files, '8-handover.png', 640)
  console.log('переход снят')
  await ctx.close()
}

await b.close()
