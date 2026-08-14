'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { A } from '@/lib/asset'
import { Water } from './Water'
import { BRAND, HERO_TAG, HERO_TITLE, HOURS_LINE } from '@/lib/content'
import { E, reduced } from '@/lib/motion'
import {
  FG_MASK,
  PHI,
  TITLE_GAP,
  TITLE_GAP_MIN,
  TITLE_RATIO,
  TITLE_RATIO_M,
  WM_BASE,
  WM_PAD,
} from '@/lib/hero'

/**
 * Надпись кнопки по литерам.
 *
 * При наведении литеры по одной приподнимаются и на мгновение мутнеют,
 * будто испаряются. Мутная копия — ПСЕВДОЭЛЕМЕНТ (`data-c` → `::after`),
 * а не второй узел рядом с буквой: второй узел попадал в текстовое
 * содержимое, и подпись читалась как «ЗЗааппииссааттььссяя» — в
 * разметке, в буфере обмена и у экранного диктора.
 */
function PuffLabel({ text }: { text: string }) {
  return (
    <span className="pf">
      {text.split('').map((c, i) => (
        <b className="pf__l" key={i} data-c={c} style={{ '--i': i } as React.CSSProperties}>
          {c === ' ' ? '\u00a0' : c}
        </b>
      ))}
    </span>
  )
}

/**
 * Сцена героя.
 *
 * Кадр держат три вещи, и ровно в этом порядке.
 *
 * Одно имя во весь экран. TERMA — не подпись, а главный объект: слово
 * идёт во всю ширину, литера ростом в треть экрана, базовая линия на
 * горизонтали золотого сечения.
 *
 * Перекрытие даёт глубину. Слово стоит В ЧАШЕ бассейна, а не поверх
 * фотографии: плита крыши срезает верх «Р» и «М», чёрные стойки
 * остекления проходят сквозь «М» и «А». Перекрытие сделано второй
 * копией ТОЙ ЖЕ фотографии под маской переднего плана — ни одного
 * нового пикселя в кадре не появляется, меняется только порядок
 * глубины.
 *
 * Всё остальное мелко и по кромкам: навигация, две подписи и одна
 * кнопка. Контраст масштабов и есть приём.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null)

  /**
   * Раскладка.
   *
   * Кегль вордмарка не задаётся, а выводится из ширины кадра: слово во
   * всю ширину при известной сумме ширин литер даёт ровно один размер.
   * Ширины берутся замером в canvas, а не из таблицы — так раскладка
   * переживает смену гарнитуры.
   */
  useEffect(() => {
    const el = root.current
    if (!el) return
    const stage = el.querySelector('.hero__stage') as HTMLElement
    const wm = el.querySelector('.wm') as HTMLElement
    const title = el.querySelector('.hero__title') as HTMLElement
    if (!stage || !wm || !title) return

    const ctx = document.createElement('canvas').getContext('2d')!

    const fit = () => {
      const w = stage.clientWidth
      const h = stage.clientHeight
      if (!w || !h) return

      const cs = getComputedStyle(wm)
      ctx.font = `${cs.fontWeight} 100px ${cs.fontFamily}`
      const sum = ctx.measureText(BRAND).width / 100
      const size = (w * (1 - WM_PAD * 2)) / sum

      stage.style.setProperty('--wm-size', `${size.toFixed(2)}px`)
      stage.style.setProperty('--wm-base', `${Math.round(h * WM_BASE)}px`)
      stage.style.setProperty('--phi-x', `${Math.round(w * PHI)}px`)
      stage.style.setProperty('--phi-y', `${Math.round(h * PHI)}px`)

      // Заголовок мельче имени и стоит над ним.
      const mob = window.matchMedia('(max-width: 860px)').matches
      const ts = size * (mob ? TITLE_RATIO_M : TITLE_RATIO)
      title.style.fontSize = `${ts.toFixed(2)}px`
      const cap = parseFloat(cs.getPropertyValue('--wm-cap')) || 0.723
      const gap = Math.max(size * TITLE_GAP, TITLE_GAP_MIN)
      title.style.bottom = `${Math.round(h - (h * WM_BASE - size * cap) + gap)}px`
    }

    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(stage)
    // Кегль снят по метрикам гарнитуры: до её загрузки замер шёл бы по
    // подменному шрифту и слово прыгнуло бы после подмены.
    document.fonts?.ready.then(fit)

    return () => ro.disconnect()
  }, [])

  /**
   * Вход, 1.8 с ровно.
   *
   * Фотография уже на экране — она не проявляется и ничем не закрыта.
   * Первым собирается имя: литеры приходят снизу со сдвигом 0.06.
   * Отражение проступает следом, с задержкой 0.3 (его ведёт сама вода).
   * Заголовок построчно. Навигация, подписи и кнопка — последними.
   */
  useEffect(() => {
    const el = root.current
    if (!el || reduced()) return

    const q = gsap.utils.selector(el)
    const tl = gsap.timeline({ defaults: { ease: E.out } })

    tl.fromTo(
      q('.wm i > span'),
      { yPercent: 120, y: 0 },
      { yPercent: 0, y: 0, duration: 0.85, stagger: 0.06 },
      0,
    )
      .fromTo(
        q('.hero__title .ln'),
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.1 },
        1.05,
      )
      .fromTo(
        document.querySelectorAll('.hdr__link'),
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.02 },
        1.34,
      )
      .fromTo(
        q('.hero__edge, .hero__cta'),
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.03 },
        1.34,
      )

    if (new URLSearchParams(window.location.search).get('shot') === '1') {
      ;(window as unknown as { __intro?: gsap.core.Timeline }).__intro = tl
    }
    return () => {
      tl.kill()
    }
  }, [])

  const picture = (cls: string) => (
    <picture className={cls}>
      {/* Мобильная — отдельный кадр 9:16, а не обрезанный десктопный. */}
      <source
        media="(max-width: 860px)"
        type="image/avif"
        sizes="100vw"
        srcSet={`${A('/img/hero-mobile-800.avif')} 800w, ${A('/img/hero-mobile-1200.avif')} 1200w`}
      />
      <source
        media="(max-width: 860px)"
        type="image/webp"
        sizes="100vw"
        srcSet={`${A('/img/hero-mobile-800.webp')} 800w, ${A('/img/hero-mobile-1200.webp')} 1200w`}
      />
      <source
        type="image/avif"
        sizes="100vw"
        srcSet={`${A('/img/hero-desktop-1600.avif')} 1600w, ${A('/img/hero-desktop-2400.avif')} 2400w`}
      />
      <source
        type="image/webp"
        sizes="100vw"
        srcSet={`${A('/img/hero-desktop-1600.webp')} 1600w, ${A('/img/hero-desktop-2400.webp')} 2400w`}
      />
      <img
        src={A('/img/hero-desktop-1600.webp')}
        alt="Инфинити-бассейн комплекса над зимней долиной"
        width={2752}
        height={1536}
        fetchPriority="high"
        decoding="sync"
      />
    </picture>
  )

  return (
    <section className="hero" id="top" ref={root}>
      <div className="hero__stage">
        {/* Фотография. Поверх неё не лежит ни одного слоя. */}
        <div className="hero__bg">{picture('')}</div>

        {/* Вода: рябь и волны от курсора, отражение имени. */}
        <Water />

        {/* Имя. Главный объект кадра. */}
        <p className="wm" aria-hidden="true">
          {BRAND.split('').map((c, i) => (
            <i key={i}>
              <span>{c}</span>
            </i>
          ))}
          {/* Носитель цвета отражения. Пустой узел нужен потому, что
              `getPropertyValue` отдаёт переменную неразвёрнутой, а
              холсту нужен готовый цвет. */}
          <i className="wm__ink" />
        </p>

        {/* Передний план: ТА ЖЕ фотография под маской крыши и стоек.
            Она перекрывает имя — отсюда глубина. */}
        <div
          className="hero__fg"
          aria-hidden="true"
          style={{
            WebkitMaskImage: `url(${A(FG_MASK)})`,
            maskImage: `url(${A(FG_MASK)})`,
          }}
        >
          {picture('')}
        </div>

        <h1 className="hero__title">
          {HERO_TITLE.map((line) => (
            <span className="ln" key={line}>
              {line}
            </span>
          ))}
        </h1>

        {/* Кнопка садится углом на пересечение линий золотого сечения. */}
        <a className="btn btn--hero btn--puff hero__cta" href="#zapis" aria-label="Записаться">
          <PuffLabel text="Записаться" />
        </a>

        <span className="hero__edge hero__edge--l">{HOURS_LINE}</span>
        <span className="hero__edge hero__edge--r">{HERO_TAG}</span>
      </div>
    </section>
  )
}
