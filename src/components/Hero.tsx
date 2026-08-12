'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { A } from '@/lib/asset'
import { Water } from './Water'
import { HERO_TAG, HERO_TITLE, HOURS_LINE } from '@/lib/content'
import { E, reduced } from '@/lib/motion'
import { WATER_LINE, cover } from '@/lib/water'

/**
 * Надпись кнопки по литерам.
 *
 * При наведении литеры по одной приподнимаются и на мгновение мутнеют,
 * будто испаряются, потом возвращаются чёткими. Волна слева направо,
 * сдвиг 0.03 с, весь цикл 0.5 с. Едут только `transform` и `opacity`;
 * мутность — тень текста с постоянным радиусом, она не пересчитывается.
 */
function PuffLabel({ text }: { text: string }) {
  return (
    <span className="pf">
      {text.split('').map((c, i) => (
        <b className="pf__l" key={i} style={{ '--i': i } as React.CSSProperties}>
          <b className="pf__s">{c === ' ' ? ' ' : c}</b>
          <b className="pf__f" aria-hidden="true">
            {c === ' ' ? ' ' : c}
          </b>
        </b>
      ))}
    </span>
  )
}

/**
 * Сцена героя.
 *
 * Над фотографией не лежит ни одного слоя: ни пелены, ни притенения, ни
 * зерна, ни подложек под текст. Кадр отдаётся как снят — всё, что нужно
 * было поправить по светлоте, поправлено в самом файле на сборке.
 *
 * Композиция держится тремя вещами: навигация вверху, заголовок на
 * линии воды с отражением в ней и одна тонкая строка внизу. Вордмарка
 * в кадре нет — слово живёт в шапке со второй сцены.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null)

  /**
   * Кегль заголовка и линия воды.
   *
   * Обе величины не выводятся из разметки: линия воды — точка
   * ФОТОГРАФИИ, её экранное положение зависит от того, как кадр обрезан
   * под площадку; кегль подбирается по фактической ширине строк в
   * выбранной гарнитуре, а не по формуле от числа знаков.
   *
   * Строки разной длины подтягиваются к одной ширине трекингом — тогда
   * обе почти касаются кромок, а не только длинная.
   */
  useEffect(() => {
    const el = root.current
    if (!el) return
    const stage = el.querySelector('.hero__stage') as HTMLElement
    const img = el.querySelector('.hero__bg img') as HTMLImageElement
    const title = el.querySelector('.hero__title') as HTMLElement
    const lines = Array.from(el.querySelectorAll<HTMLElement>('.ln > i'))
    if (!stage || !img || !title) return

    const c = document.createElement('canvas').getContext('2d')!

    const fit = () => {
      const w = stage.clientWidth
      const h = stage.clientHeight
      if (!w || !h) return

      const mob = window.matchMedia('(max-width: 860px)').matches
      const cv = cover(w, h, img.naturalWidth || 2752, img.naturalHeight || 1536)
      const wl = cv.oy + (mob ? WATER_LINE.mobile : WATER_LINE.desktop) * cv.dh
      stage.style.setProperty('--water-line', `${Math.round(wl)}px`)

      const cs = getComputedStyle(title)
      const pad = mob ? 0.055 : 0.028
      const target = w * (1 - pad * 2)

      // Ширина строк при кегле 100 px — дальше всё линейно.
      c.font = `${cs.fontWeight} 100px ${cs.fontFamily}`
      const nat = lines.map((l) => c.measureText(l.textContent || '').width)
      const size = Math.floor((target / Math.max(...nat)) * 100)
      title.style.fontSize = `${size}px`

      lines.forEach((l, i) => {
        const n = (l.textContent || '').length
        const wide = (nat[i] * size) / 100
        // Недостающую ширину раздаём в межбуквенные просветы. Последний
        // знак просвета не получает — иначе строка съедет влево.
        const extra = n > 1 ? (target - wide) / (n - 1) : 0
        l.style.letterSpacing = `${extra.toFixed(2)}px`
        // Просвет после последнего знака выключка по центру считает за
        // ширину строки. Снимаем его отрицательным полем.
        l.style.marginRight = `${(-extra).toFixed(2)}px`
      })
    }

    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(stage)
    // Кегль снят по метрикам гарнитуры — до её загрузки он был бы снят
    // по подменному шрифту и после подмены строка бы прыгнула.
    document.fonts?.ready.then(fit)

    return () => ro.disconnect()
  }, [])

  /**
   * Вход.
   *
   * Фотография уже на экране — она не проявляется и ничем не закрыта.
   * Приходит только набор: строки заголовка снизу со сдвигом 0.12,
   * следом отражение (его ведёт сама вода), последними — нижняя строка
   * и навигация. Всё укладывается в 1.6 с. Ни вуалей, ни штор.
   */
  useEffect(() => {
    const el = root.current
    if (!el || reduced()) return

    const q = gsap.utils.selector(el)
    const tl = gsap.timeline({ defaults: { ease: E.out } })

    // Строки: снизу, по одной, сдвиг 0.12. Вторая доезжает к 1.02 с.
    // `y: 0` задаётся явно — стартовая позиция описана в CSS процентами,
    // и GSAP разбирает её в пиксельный y, который иначе остался бы
    // поверх анимации yPercent навсегда.
    tl.fromTo(
      q('.ln > i'),
      { yPercent: 132, y: 0 },
      { yPercent: 0, y: 0, duration: 0.9, stagger: 0.12 },
      0,
    )
      // Отражение проявляется следом — его ведёт сама вода, ramp внутри
      // `Water.tsx` с 1.02 по 1.38 с.
      .fromTo(
        q('.hero__foot > *'),
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.05 },
        1.05,
      )
      .fromTo(
        document.querySelectorAll('.hdr__link'),
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.42, stagger: 0.035 },
        1.06,
      )

    if (new URLSearchParams(window.location.search).get('shot') === '1') {
      ;(window as unknown as { __intro?: gsap.core.Timeline }).__intro = tl
    }
    return () => {
      tl.kill()
    }
  }, [])

  return (
    <section className="hero" id="top" ref={root}>
      <div className="hero__stage">
        {/* Фотография. Ни одного слоя поверх — ни в разметке, ни в CSS. */}
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

        {/* Вода. Холст лежит на габарите бассейна и больше нигде. */}
        <Water />

        {/* Заголовок на линии воды. Отражение рисует вода. */}
        <h1 className="hero__title">
          {HERO_TITLE.map((line) => (
            <span className="ln" key={line}>
              <i>{line}</i>
            </span>
          ))}
        </h1>

        <div className="hero__foot">
          <span className="hero__hours js-in">{HOURS_LINE}</span>
          <a className="btn btn--hero btn--puff js-in" href="#zapis" aria-label="Записаться">
            <PuffLabel text="Записаться" />
          </a>
          <span className="hero__tag js-in">{HERO_TAG}</span>
        </div>
      </div>
    </section>
  )
}
