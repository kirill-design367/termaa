/**
 * Аудит: консоль, вёрстка, интерактив, анимации — на трёх разрешениях.
 * Запуск: node scripts/audit.mjs [base]
 */
import { chromium } from 'playwright'

const BASE = process.argv[2] || 'http://127.0.0.1:8099/termaa/'
const EXEC = '/opt/pw-browsers/chromium'
const VIEWS = [
  { id: '1920×1080', w: 1920, h: 1080, dsf: 1 },
  { id: '2560×1440', w: 2560, h: 1440, dsf: 1 },
  { id: '390×844', w: 390, h: 844, dsf: 2, mobile: true },
]

const found = []
const add = (sev, view, what) => found.push({ sev, view, what })

const browser = await chromium.launch({ executablePath: EXEC })

for (const v of VIEWS) {
  const ctx = await browser.newContext({
    viewport: { width: v.w, height: v.h },
    deviceScaleFactor: v.dsf,
    isMobile: !!v.mobile,
    hasTouch: !!v.mobile,
    reducedMotion: 'no-preference',
  })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') add('высокая', v.id, `консоль: ${m.text().slice(0, 160)}`)
    if (m.type() === 'warning' && /React|hydrat|key|prop/i.test(m.text()))
      add('средняя', v.id, `предупреждение: ${m.text().slice(0, 160)}`)
  })
  page.on('pageerror', (e) => add('критическая', v.id, `исключение: ${e.message.slice(0, 160)}`))
  page.on('requestfailed', (r) =>
    add('высокая', v.id, `запрос не прошёл: ${r.url().split('/').pop()} — ${r.failure()?.errorText}`),
  )
  page.on('response', (r) => {
    if (r.status() >= 400) add('высокая', v.id, `${r.status()} на ${r.url().split('/').pop()}`)
  })

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3400)

  // ── Горизонтальный вылет и элементы шире экрана ────────────────────
  const overflow = await page.evaluate(() => {
    const bad = []
    if (document.documentElement.scrollWidth > window.innerWidth + 1)
      bad.push(`страница шире вьюпорта на ${document.documentElement.scrollWidth - window.innerWidth}px`)
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const cs = getComputedStyle(el)
      if (cs.position === 'fixed') continue
      // Элемент под обрезающим предком за кадр не вылезает: горизонтальной
      // прокрутки он не даёт и глазу не виден. Отдельно отсеиваем
      // предмасштабированные слои — их габарит шире вьюпорта по замыслу.
      let clipped = false
      for (let a = el.parentElement; a; a = a.parentElement) {
        const ac = getComputedStyle(a)
        if (ac.overflow !== 'visible' || ac.contain.includes('paint')) { clipped = true; break }
      }
      if (clipped) continue
      if (cs.transform !== 'none' && !cs.transform.startsWith('matrix(1,')) continue
      if (r.right > window.innerWidth + 2 && !el.closest('.revs__track,.hero__bg,.hero__title,.water,.visit__drops'))
        bad.push(`${el.className || el.tagName} вылезает вправо на ${Math.round(r.right - window.innerWidth)}px`)
    }
    return [...new Set(bad)].slice(0, 8)
  })
  overflow.forEach((o) => add('средняя', v.id, `вёрстка: ${o}`))

  // ── Пересечения и наложения фиксированных кнопок на текст ──────────
  const collide = await page.evaluate(() => {
    const fab = document.querySelector('.fab')
    if (!fab) return []
    const f = fab.getBoundingClientRect()
    if (f.width === 0) return []
    const bad = []
    for (const el of document.querySelectorAll('h1,h2,h3,p,a,button,li,dd,dt')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) continue
      if (el.closest('.fab')) continue
      const ov = Math.min(f.right, r.right) - Math.max(f.left, r.left)
      const oy = Math.min(f.bottom, r.bottom) - Math.max(f.top, r.top)
      if (ov > 6 && oy > 6) bad.push(`плавающая кнопка накрывает «${(el.textContent || '').trim().slice(0, 32)}»`)
    }
    return [...new Set(bad)].slice(0, 4)
  })
  collide.forEach((c) => add('средняя', v.id, c))

  // ── Проверка всех интерактивных элементов ──────────────────────────
  const links = await page.$$eval('a[href^="#"]', (els) => els.map((e) => e.getAttribute('href')))
  for (const href of [...new Set(links)]) {
    const ok = await page.evaluate((h) => !!document.querySelector(h), href)
    if (!ok) add('высокая', v.id, `якорь ${href} никуда не ведёт`)
  }
  const tel = await page.$$eval('a[href^="tel:"]', (els) => els.map((e) => e.getAttribute('href')))
  if (!tel.length) add('высокая', v.id, 'нет кликабельного телефона')

  // Аккордеон: раскрыть каждый вопрос и проверить, что ответ виден.
  const qs = await page.$$('.faq__q')
  for (let i = 0; i < qs.length; i++) {
    await qs[i].scrollIntoViewIfNeeded()
    // Первый вопрос раскрыт по умолчанию — клик его закрывает.
    // Чтобы проверять именно раскрытие, сначала приводим к закрытому.
    const open = await qs[i].evaluate((b) => b.getAttribute('aria-expanded') === 'true')
    if (open) { await qs[i].click(); await page.waitForTimeout(700) }
    await qs[i].click()
    // Переход раскрытия идёт 620 мс; на большом вьюпорте кадр успевает
    // отстать, и замер на 650 мс ловил его на полпути. Ждём с запасом.
    await page.waitForTimeout(1000)
    const h = await page.evaluate((n) => {
      const w = document.querySelectorAll('.faq__wrap')[n]
      return w ? w.getBoundingClientRect().height : -1
    }, i)
    if (h < 20) add('высокая', v.id, `ответ ${i + 1} в «Вопросах» не раскрылся (высота ${Math.round(h)})`)
  }

  // Форма: отправка пустой, мягкая валидация, затем успешный сценарий.
  await page.evaluate(() => document.querySelector('#zapis')?.scrollIntoView())
  await page.waitForTimeout(700)
  const btn = await page.$('.book__form button[type=submit]')
  if (!btn) add('критическая', v.id, 'кнопка отправки формы не найдена')
  else {
    await btn.click()
    await page.waitForTimeout(300)
    const miss = await page.$$eval('.fld[data-miss="1"]', (e) => e.length)
    if (miss === 0) add('высокая', v.id, 'пустая форма отправляется без подсветки полей')
    await page.fill('#f-name', 'Кирилл')
    await page.fill('#f-phone', '+7 900 000-00-00')
    await page.fill('#f-date', '20.02.2026')
    await btn.click()
    await page.waitForTimeout(500)
    const done = await page.$('.book__done')
    if (!done) add('критическая', v.id, 'форма не показывает подтверждение после отправки')
  }

  // ── Анимации от начала до конца: прокрутка всей страницы ───────────
  const errs0 = found.length
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
  const H = await page.evaluate(() => document.body.scrollHeight)
  for (let y = 0; y < H; y += Math.round(v.h * 0.4)) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y)
    await page.waitForTimeout(120)
  }
  await page.waitForTimeout(900)
  // Пустые экраны: ищем участки без единого видимого текста.
  const blanks = await page.evaluate(() => {
    const out = []
    const step = window.innerHeight
    for (let y = 0; y < document.body.scrollHeight - step; y += step) {
      window.scrollTo(0, y)
      let n = 0
      for (const el of document.querySelectorAll('h1,h2,h3,p,li,dd,button,a')) {
        const r = el.getBoundingClientRect()
        if (r.top < window.innerHeight && r.bottom > 0 && r.width > 0 && el.textContent.trim()) n++
      }
      if (n === 0) out.push(Math.round(y / step))
    }
    return out
  })
  blanks.forEach((i) => add('средняя', v.id, `экран №${i + 1} при прокрутке пустой — нет ни одного текстового элемента`))
  if (found.length === errs0) add('info', v.id, 'прокрутка всей страницы прошла без ошибок в консоли')

  await ctx.close()
}

await browser.close()

const order = { критическая: 0, высокая: 1, средняя: 2, info: 3 }
found.sort((a, b) => order[a.sev] - order[b.sev])
const uniq = []
const seen = new Set()
for (const f of found) {
  const k = f.sev + f.what
  if (seen.has(k)) continue
  seen.add(k)
  uniq.push(f)
}
console.log(`\nНайдено записей: ${uniq.length}\n`)
for (const f of uniq) console.log(`[${f.sev}] ${f.view.padEnd(10)} ${f.what}`)
