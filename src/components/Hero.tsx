'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { A } from '@/lib/asset'
import { SteamFlow } from './SteamFlow'
import { SteamVolume } from './SteamVolume'
import { BRAND, HOURS } from '@/lib/content'
import { D, E, STAGGER, reduced } from '@/lib/motion'

const LETTERS = BRAND.split('')
const H1 = ['Горячая вода', 'на высоте 1800']

/**
 * Строка заголовка по литерам.
 *
 * Каждая литера стоит дважды: чёткая и мутная. Мутность — не фильтр в
 * кадре, а тень текста с постоянным радиусом: она рисуется вместе с
 * набором, ничего не пересчитывает и радиус её не анимируется. В рантайме
 * едет только непрозрачность, и по концу входа мутный слой снимается
 * совсем — в покое от него не остаётся ничего.
 */
function GlassLine({ text }: { text: string }) {
  return (
    <span className="ln">
      {text.split('').map((c, i) => (
        <i className="gl" key={i}>
          <b className="gl__s">{c === ' ' ? ' ' : c}</b>
          <b className="gl__f" aria-hidden="true">
            {c === ' ' ? ' ' : c}
          </b>
        </i>
      ))}
    </span>
  )
}

/**
 * Сцена героя.
 *
 * Секция 260svh, внутри липкая площадка в экран. Развитие по скроллу
 * пишет мастер-таймлайн (`Scene.tsx`) — здесь вход по загрузке, живой
 * фон и разметка.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    if (reduced()) return

    const q = gsap.utils.selector(el)
    const tl = gsap.timeline({ defaults: { ease: E.out } })

    tl.fromTo(q('.hero__veil'), { opacity: 1 }, { opacity: 0, duration: D.xl, ease: 'power2.out' }, 0)
      .fromTo(q('.hero__frame'), { scale: 1.06 }, { scale: 1, duration: D.xl, ease: 'power2.out' }, 0)
      // y: 0 задаётся явно. Стартовая позиция описана в CSS как
      // translateY(108%), и GSAP разбирает её в пиксельный y — без
      // обнуления он остался бы поверх анимации yPercent навсегда.
      .fromTo(
        q('.wm span'),
        { yPercent: 108, y: 0 },
        { yPercent: 0, y: 0, duration: 1.5, stagger: STAGGER.letters },
        0.25,
      )
      // Запотевшее стекло: литеры проясняются по одной слева направо.
      // Радиус мутности постоянен, меняется только непрозрачность.
      .fromTo(
        q('.gl__s'),
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.045 },
        0.55,
      )
      .fromTo(
        q('.gl__f'),
        { opacity: 1 },
        { opacity: 0, duration: 0.62, ease: 'power2.out', stagger: 0.045 },
        0.55,
      )
      // Мутный слой больше не нужен — снимаем его из кадра совсем.
      .set(q('.gl__f'), { visibility: 'hidden' })
      .fromTo(
        document.querySelectorAll('.js-in'),
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: D.m, stagger: STAGGER.ui },
        1.25,
      )

    // Диагностический доступ к таймлайну входа: снимальщик ставит его на
    // нужную миллисекунду. В бою не включается.
    if (new URLSearchParams(window.location.search).get('shot') === '1') {
      ;(window as unknown as { __intro?: gsap.core.Timeline }).__intro = tl
    }

    // ── Кадр живой: очень медленный дрейф, амплитуда 8 px, цикл 20 с ──
    const drift = gsap.to(q('.hero__frame'), {
      keyframes: {
        '0%': { xPercent: 0, yPercent: 0 },
        '25%': { xPercent: 0.22, yPercent: -0.18 },
        '50%': { xPercent: 0.36, yPercent: 0.16 },
        '75%': { xPercent: 0.1, yPercent: 0.3 },
        '100%': { xPercent: 0, yPercent: 0 },
      },
      duration: 20,
      ease: 'none',
      repeat: -1,
    })

    return () => {
      tl.kill()
      drift.kill()
    }
  }, [])

  return (
    <section className="hero" id="top" ref={root}>
      <div className="hero__stage">
        {/* Слой 1 — фотография. Внешний узел ведёт мастер-таймлайн,
            внутренний дрейфует сам: две анимации на одном узле дрались
            бы за transform. */}
        <div className="hero__bg">
          <div className="hero__frame">
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

            {/* Рябь — только по воде. Область задана испечённой маской,
                слой едет трансформом: своего движения у фотографии нет. */}
            <div className="hero__ripple" aria-hidden="true" />
          </div>
          <div className="hero__veil" aria-hidden="true" />
        </div>

        {/* Слой 2 — текст. Под ним локальная подложка, без видимой границы. */}
        <div className="hero__copy">
          <div className="hero__grid">
            <h1>
              {H1.map((line) => (
                <GlassLine text={line} key={line} />
              ))}
            </h1>
            <p className="hero__lead js-in">Термальный комплекс в горах. Открыто {HOURS}.</p>
            <div className="hero__acts">
              <a className="btn btn--glass js-in" href="#zapis">
                <i className="btn__fog" aria-hidden="true" />
                <i className="btn__fog" aria-hidden="true" />
                <i className="btn__fog" aria-hidden="true" />
                <span>Записаться</span>
              </a>
              <a className="btn btn--ghost btn--glass js-in" href="#tseny">
                <i className="btn__fog" aria-hidden="true" />
                <i className="btn__fog" aria-hidden="true" />
                <i className="btn__fog" aria-hidden="true" />
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
