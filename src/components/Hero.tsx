'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { A } from '@/lib/asset'
import { BRAND, HERO_FOOT, HERO_TITLE } from '@/lib/content'
import { E, reduced } from '@/lib/motion'
import {
  PHI,
  TITLE_GAP,
  TITLE_RATIO_M,
  TITLE_W,
  WM_BASE,
  WM_BASE_M,
  WM_CAP,
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
          {c === ' ' ? ' ' : c}
        </b>
      ))}
    </span>
  )
}

/**
 * Сцена героя.
 *
 * ОДНА фотография одним слоем и набор поверх неё. Больше в кадре нет
 * ничего: ни холста воды, ни второй копии снимка под маской переднего
 * плана. Обе уехали по одной причине — на скролле кадр расслаивался.
 * Мастер-таймлайн уводил фотографию масштабом, а лежащие поверх копии
 * оставались на месте, и по кадру шёл разрыв. С одним слоем такого не
 * может случиться по построению.
 *
 * Сверху вниз кадр читается так: имя с базовой линией на золотой
 * горизонтали, под ним заголовок в две строки, у нижней кромки —
 * режим, адрес и кнопка. Контраст масштабов между именем и мелким
 * набором и есть приём.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null)

  /**
   * Раскладка.
   *
   * Кегль имени выводится из двух условий сразу и берётся меньшее: рост
   * литеры в 22 % высоты экрана — главное условие, ширина кадра минус
   * поля — ограничение. Ширины литер снимаются замером в canvas, а не
   * из таблицы: так раскладка переживает смену гарнитуры.
   */
  useEffect(() => {
    const el = root.current
    if (!el) return
    const stage = el.querySelector('.hero__stage') as HTMLElement
    const wm = el.querySelector('.wm') as HTMLElement
    const title = el.querySelector('.hero__title') as HTMLElement
    const foot = el.querySelector('.hero__foot') as HTMLElement
    if (!stage || !wm || !title) return

    const ctx = document.createElement('canvas').getContext('2d')!

    const fit = () => {
      const w = stage.clientWidth
      const h = stage.clientHeight
      if (!w || !h) return

      const cs = getComputedStyle(wm)
      ctx.font = `${cs.fontWeight} 100px ${cs.fontFamily}`
      const sum = ctx.measureText(BRAND).width / 100
      const cap = parseFloat(cs.getPropertyValue('--wm-cap')) || 0.723

      const mob = window.matchMedia('(max-width: 860px)').matches
      const base = mob ? WM_BASE_M : WM_BASE
      // Высота важнее ширины: слово, не дотянувшее до полей, — норма,
      // литера выше заданной — нет. Второе выражение только страхует
      // узкий экран, где 22 % высоты не влезли бы по ширине.
      const size = Math.min((h * WM_CAP) / cap, (w * (1 - WM_PAD * 2)) / sum)

      stage.style.setProperty('--wm-size', `${size.toFixed(2)}px`)
      stage.style.setProperty('--wm-base', `${Math.round(h * base)}px`)
      stage.style.setProperty('--phi-x', `${Math.round(w * PHI)}px`)
      stage.style.setProperty('--phi-y', `${Math.round(h * PHI)}px`)

      /* Заголовок стоит ПОД именем и над нижней строкой, и обе границы
         жёсткие. Поэтому он не «ставится сверху», а ВПИСЫВАЕТСЯ в
         просвет: сначала считается сам просвет, потом кегль.

         На мобильной он остаётся НАД именем: там имя опущено на воду
         ради контраста, и под ним просвета нет вовсе — а сверху пустое
         небо во весь экран. */
      const gap = size * TITLE_GAP
      const lines = title.querySelectorAll('.ln').length || 1
      const lh = parseFloat(getComputedStyle(title).lineHeight) / (parseFloat(cs.fontSize) || 1)
      const lhr = isFinite(lh) && lh > 0 ? lh : 1.02

      if (mob) {
        const nav = document.querySelector('.hdr__nav')
        const headH =
          (nav?.getBoundingClientRect().bottom ??
            parseFloat(
              getComputedStyle(document.documentElement).getPropertyValue('--header-h'),
            )) || 69
        const top = headH + 12
        const room = h * base - size * cap - gap - top
        const ts = Math.min(size * TITLE_RATIO_M, room / (lines * lhr))
        title.style.fontSize = `${ts.toFixed(2)}px`
        title.style.top = `${Math.round(top)}px`
        return
      }

      const top = h * base + gap
      const footTop = foot ? foot.getBoundingClientRect().top : h
      const room = Math.max(0, footTop - top - 24)
      const ts = Math.min(w * TITLE_W, room / (lines * lhr))
      title.style.fontSize = `${ts.toFixed(2)}px`
      title.style.top = `${Math.round(top)}px`
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
   * Заголовок построчно. Навигация, подписи и кнопка — последними.
   */
  useEffect(() => {
    const el = root.current
    if (!el || reduced()) return

    const q = gsap.utils.selector(el)
    const tl = gsap.timeline({ defaults: { ease: E.out } })

    tl.fromTo(
      q('.wm--main i > span'),
      { yPercent: 120, y: 0 },
      { yPercent: 0, y: 0, duration: 0.85, stagger: 0.06 },
      0,
    )
      .fromTo(
        q('.hero__title .ln > i > span'),
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
        q('.hero__foot > *'),
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.05 },
        1.34,
      )

    if (new URLSearchParams(window.location.search).get('shot') === '1') {
      ;(window as unknown as { __intro?: gsap.core.Timeline }).__intro = tl
    }
    return () => {
      tl.kill()
    }
  }, [])

  /** Литеры имени. Одна и та же разметка идёт в слово и в отражение. */
  const letters = BRAND.split('').map((c, i) => (
    <i key={i}>
      <span>{c}</span>
    </i>
  ))

  return (
    <section className="hero" id="top" ref={root}>
      <div className="hero__stage">
        {/* Фотография. Одна, одним слоем, без единого слоя поверх. */}
        <div className="hero__bg">
          <picture>
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
        </div>

        {/* Имя. Главный объект кадра. Обёртка нужна мастер-таймлайну:
            слово уходит из кадра вместе с фотографией. */}
        <div className="hero__name" aria-hidden="true">
          <p className="wm wm--main">{letters}</p>
        </div>

        <h1 className="hero__title">
          {HERO_TITLE.map((line, i) => (
            <span className="ln" key={line}>
              {/* Узлов два, и это не лишний слой. По внешнему строку
                  уводит мастер-таймлайн на скролле, по внутреннему её
                  приводит вход. На одном узле они дрались: `fromTo`
                  мастера ставит своё начальное состояние сразу при
                  сборке и до старта входа держал заголовок видимым —
                  строка вспыхивала, а на 1.05 с пропадала и приезжала
                  заново. */}
              <i>
                <span>{i < HERO_TITLE.length - 1 ? `${line} ` : line}</span>
              </i>
            </span>
          ))}
        </h1>

        {/* Нижняя строка: режим, адрес и кнопка — одним блоком у левой
            кромки. Кнопки в середине кадра больше нет. */}
        <div className="hero__foot">
          {HERO_FOOT.map((line) => (
            <span className="hero__edge" key={line}>
              {line}
            </span>
          ))}
          <a className="btn btn--hero btn--puff hero__cta" href="#zapis" aria-label="Записаться">
            <PuffLabel text="Записаться" />
          </a>
        </div>
      </div>
    </section>
  )
}
