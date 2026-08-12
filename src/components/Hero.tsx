'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { A } from '@/lib/asset'
import { SteamFlow } from './SteamFlow'
import { SteamVolume } from './SteamVolume'
import { BRAND, HOURS } from '@/lib/content'
import { D, E, STAGGER, reduced } from '@/lib/motion'

const LETTERS = BRAND.split('')

/**
 * Сцена героя.
 *
 * Это уже не экран в 100vh, а протяжённая сцена: секция высотой 200svh,
 * внутри неё липкая площадка в экран. Развитие по скроллу пишет мастер-
 * таймлайн (`Scene.tsx`) — здесь только вход по загрузке и разметка.
 *
 * Порядок слоёв: фотография → текст → поток. Слово рисует сам объём и
 * ставит его поверх основной массы пара; разметочный вордмарк остаётся
 * для отката и включается, когда объёма нет.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    if (reduced()) return

    const q = gsap.utils.selector(el)
    const tl = gsap.timeline({ defaults: { ease: E.out } })

    // Фон проявляется из темноты и садится с 1.06 в 1.0. Гаснет отдельное
    // полотно, а не сам кадр: снимок должен быть отрисован сразу, иначе
    // метрика LCP считает не его.
    tl.fromTo(q('.hero__veil'), { opacity: 1 }, { opacity: 0, duration: D.xl, ease: 'power2.out' }, 0)
      .fromTo(q('.hero__bg'), { scale: 1.06 }, { scale: 1, duration: D.xl, ease: 'power2.out' }, 0)
      // y: 0 задаётся явно. Стартовая позиция описана в CSS как
      // translateY(128%), и GSAP разбирает её в пиксельный y — без
      // обнуления он остался бы поверх анимации yPercent навсегда.
      .fromTo(
        q('.wm span'),
        { yPercent: 108, y: 0 },
        { yPercent: 0, y: 0, duration: 1.5, stagger: STAGGER.letters },
        0.25,
      )
      .fromTo(
        q('h1 .ln > span'),
        { yPercent: 128, y: 0 },
        { yPercent: 0, y: 0, duration: 1.15, stagger: STAGGER.lines },
        0.55,
      )
      .fromTo(
        document.querySelectorAll('.js-in'),
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: D.m, stagger: STAGGER.ui },
        1.25,
      )

    return () => {
      tl.kill()
    }
  }, [])

  return (
    <section className="hero" id="top" ref={root}>
      <div className="hero__stage">
        {/* Слой 1 — фотография */}
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
          <div className="hero__veil" aria-hidden="true" />
        </div>

        {/* Слой 2 — текст. Под ним локальная подложка, без видимой границы. */}
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
            <p className="hero__lead js-in">Термальный комплекс в горах. Открыто {HOURS}.</p>
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

        {/* Слой 3 — вордмарк отката. Живой объём рисует слово сам. */}
        <div className="wm" aria-hidden="true">
          {LETTERS.map((c, i) => (
            <i key={i} style={{ display: 'block', overflow: 'hidden', fontStyle: 'normal' }}>
              <span>{c}</span>
            </i>
          ))}
        </div>

        {/* Слой 4 — поток. Испечённый работает всегда, объёмный поверх него
            там, где машина его тянет. */}
        <SteamFlow />
        <SteamVolume />
      </div>
    </section>
  )
}
