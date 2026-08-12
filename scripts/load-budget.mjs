/**
 * Бюджет загрузки: что стоит между запросом страницы и первым чистым
 * кадром героя.
 *
 * Меряется на живой отдаче статики, с холодным кэшем и с замедлением
 * процессора вчетверо — иначе на быстрой машине всё сливается в ноль и
 * причина торможения не видна.
 *
 * Три числа, которые и есть ответ:
 *   LCP        — когда отрисовано главное содержимое кадра;
 *   длинные    — сумма задач длиннее 50 мс за первые 3 с: это и есть
 *                «тупит», всё остальное — следствие;
 *   до кадра   — сколько работы просчитано ДО первой отрисовки.
 */
import { chromium } from 'playwright'

const URL = process.env.U || 'http://127.0.0.1:8099/termaa/'
const W = 1920
const H = 1080

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

const run = async (label) => {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  const cdp = await ctx.newCDPSession(p)
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.CPU || 4) })

  // Наблюдатели ставятся до первого байта страницы, иначе ранние записи
  // теряются: буфер PerformanceObserver наполняется только с момента
  // подписки, а самое интересное происходит именно в первые кадры.
  await p.addInitScript(() => {
    window.__m = { lcp: 0, long: [], paint: {}, frames: [] }
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__m.lcp = e.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__m.long.push([+e.startTime.toFixed(1), +e.duration.toFixed(1)])
    }).observe({ type: 'longtask', buffered: true })
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__m.paint[e.name] = e.startTime
    }).observe({ type: 'paint', buffered: true })
    // Межкадровые интервалы первых двух секунд: провал здесь и есть
    // видимый рывок на входе.
    const t0 = performance.now()
    let last = t0
    const tick = (now) => {
      window.__m.frames.push(+(now - last).toFixed(1))
      last = now
      if (now - t0 < 2000) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  await p.goto(URL, { waitUntil: 'load' })
  await p.waitForTimeout(3500)

  const m = await p.evaluate(() => window.__m)
  const fcp = m.paint['first-contentful-paint'] || 0
  const before = m.long.filter((x) => x[0] < fcp).reduce((s, x) => s + x[1], 0)
  const total = m.long.reduce((s, x) => s + x[1], 0)
  const worst = m.long.reduce((s, x) => Math.max(s, x[1]), 0)
  const late = m.frames.slice(2)
  const dropped = late.filter((x) => x > 50).length

  console.log(`\n── ${label} ──`)
  console.log(`первая отрисовка (FCP)   ${fcp.toFixed(0)} мс`)
  console.log(`основное содержимое (LCP) ${m.lcp.toFixed(0)} мс`)
  console.log(`длинных задач            ${m.long.length}, суммарно ${total.toFixed(0)} мс, худшая ${worst.toFixed(0)} мс`)
  console.log(`из них до первой отрисовки ${before.toFixed(0)} мс`)
  console.log(`кадров дольше 50 мс за первые 2 с: ${dropped} из ${late.length}`)
  console.log(`длинные задачи: ${JSON.stringify(m.long.slice(0, 8))}`)

  await ctx.close()
  return { fcp, lcp: m.lcp, total, worst, before, dropped }
}

await run(process.argv[2] || 'замер')
await b.close()
