'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { A } from '@/lib/asset'
import { Steam } from './Steam'
import { BRAND, HOURS } from '@/lib/content'
import { D, E, STAGGER, reduced } from '@/lib/motion'

const LETTERS = BRAND.split('')

/**
 * Герой. Три слоя по глубине: фон → вордмарк → пар. Текст лежит выше пара,
 * иначе лид и кнопки утонули бы в молоке.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return

    const q = gsap.utils.selector(el)
    const soft = reduced()

    const start = () => {
      const tl = gsap.timeline({ defaults: { ease: E.out } })

      // Вход становится мгновенным: конечные состояния уже прописаны
      // в CSS внутри @media (prefers-reduced-motion), трогать их не нужно.
      if (soft) return

      // Фон проявляется из темноты и садится с 1.06 в 1.0.
      // Гаснет отдельное полотно, а не сам кадр: снимок должен быть
      // отрисован сразу, иначе метрика LCP считает не его.
      tl.fromTo(q('.hero__veil'), { opacity: 1 }, { opacity: 0, duration: D.xl, ease: 'power2.out' }, 0)
        .fromTo(q('.hero__bg'), { scale: 1.06 }, { scale: 1, duration: D.xl, ease: 'power2.out' }, 0)
        // Вордмарк выезжает снизу, литеры со сдвигом 0.05.
        // y: 0 задаётся явно. Стартовая позиция описана в CSS как
        // translateY(112%), и GSAP разбирает её в пиксельный y — без
        // обнуления он остался бы поверх анимации yPercent навсегда.
        .fromTo(
          q('.wm span'),
          { yPercent: 108, y: 0 },
          { yPercent: 0, y: 0, duration: 1.5, stagger: STAGGER.letters },
          0.25,
        )
        // Пар проявляется поверх вордмарка с задержкой 0.4.
        .fromTo(
          q('.steam__l'),
          { opacity: 0 },
          { opacity: 1, duration: 1.4, ease: E.steam, stagger: 0.12 },
          0.65,
        )
        // Заголовок построчно, сдвиг 0.08.
        .fromTo(
          q('h1 .ln > span'),
          { yPercent: 112, y: 0 },
          { yPercent: 0, y: 0, duration: 1.15, stagger: STAGGER.lines },
          0.55,
        )
        // Шапка, лид и кнопки — последними. Шапка живёт вне героя,
        // поэтому ищем по документу, а не по секции.
        .fromTo(
          document.querySelectorAll('.js-in'),
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: D.m, stagger: STAGGER.ui },
          1.25,
        )

      return tl
    }

    // Вход стартует сразу. Ожидание document.fonts.ready стоило
    // нескольких секунд на медленной сети — всё это время лид и кнопки
    // лежали невидимыми, и метрика LCP считала именно их. Акцидентная
    // гарнитура объявлена с font-display: block и предзагружена, так что
    // к моменту выезда литер она в подавляющем большинстве случаев уже тут.
    const tl = start() as gsap.core.Timeline | undefined

    return () => {
      tl?.kill()
    }
  }, [])

  return (
    <section className="hero" id="top" ref={root}>
      {/* Слой 1 — фон */}
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
            alt="Инфинити-бассейн комплекса над зимней долиной, над водой стоит пар"
            width={2752}
            height={1536}
            fetchPriority="high"
            decoding="sync"
          />
        </picture>
        <div className="hero__scrim" />
        <div className="hero__veil" aria-hidden="true" />
      </div>

      {/* Слой 2 — вордмарк */}
      <div className="wm" aria-hidden="true">
        {LETTERS.map((c, i) => (
          <i key={i} style={{ display: 'block', overflow: 'hidden', fontStyle: 'normal' }}>
            <span>{c}</span>
          </i>
        ))}
      </div>

      {/* Слой 3 — пар */}
      <Steam />

      {/* Слой 4 — текст */}
      <div className="hero__copy">
        <div className="hero__grid">
          <h1>
            <span className="ln">
              <span>Горячая вода</span>
            </span>
            <span className="ln">
              <span>на высоте 1800</span>
            </span>
          </h1>
          <p className="hero__lead js-in">
            Термальный комплекс в горах. Открыто {HOURS}.
          </p>
          <div className="hero__acts">
            <a className="btn js-in" href="#zapis">
              <span>Записаться</span>
            </a>
            <a className="btn btn--ghost js-in" href="#tseny">
              <span>Смотреть цены</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
