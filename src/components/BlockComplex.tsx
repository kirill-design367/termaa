'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { A } from '@/lib/asset'
import { ZONES } from '@/lib/content'
import { E, reduced } from '@/lib/motion'

/** Затемнение под текстом и то, до чего оно уходит на смене зоны. */
const SCRIM = 0.6
const SCRIM_OPEN = 0.45

/**
 * Блок 1 — Комплекс.
 *
 * Скролл работает как проход внутрь: следующая зона наплывает поверх
 * предыдущей, между ними проходит тёмная вертикальная полоса — дверной
 * проём. Предыдущая зона уходит вглубь, а не вбок: это движение вперёд,
 * а не карусель.
 */
export function BlockComplex() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const q = gsap.utils.selector(el)
    const zones = q<HTMLElement>('.zone')
    const door = q<HTMLElement>('.door')[0]
    const bars = q<HTMLElement>('.zones__idx i')
    const scrims = q<HTMLElement>('.zone__scrim')

    const mark = (i: number) => bars.forEach((b, n) => (b.dataset.on = n <= i ? '1' : '0'))

    // Без движения зоны разворачиваются в список — это описано в CSS,
    // в @media (prefers-reduced-motion). Скрипту тут делать нечего.
    if (reduced()) {
      mark(ZONES.length - 1)
      return
    }

    gsap.set(zones.slice(1), { autoAlpha: 0, scale: 1.14, yPercent: 6 })
    mark(0)

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: `+=${(ZONES.length - 1) * 100}%`,
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          onUpdate: (self) => {
            mark(Math.min(ZONES.length - 1, Math.round(self.progress * (ZONES.length - 1))))
          },
        },
      })

      for (let i = 1; i < zones.length; i++) {
        const at = i - 1
        // Проём проходит быстро, смена происходит под ним.
        // Уходящая зона не гаснет — её просто накрывает следующая:
        // так две зоны не читаются одновременно дольше доли секунды.
        // x обнуляется явно. Стартовая позиция описана в CSS как
        // translateX(-130%), и GSAP разбирает её в пиксельный x — без
        // обнуления он ложится поверх анимации xPercent, и проём вместо
        // прохода паркуется посреди кадра. На тёмных зонах это было не
        // видно, на фотографии — сразу.
        // Конец 500 %, а не 130 %: при ширине 26vw проёму нужно 485 %,
        // чтобы уйти за правую кромку целиком.
        tl.fromTo(
          door,
          { xPercent: -130, x: 0 },
          { xPercent: 500, x: 0, duration: 0.62, ease: E.door },
          at,
        )
          .to(zones[i - 1], { scale: 0.9, duration: 0.6, ease: 'power2.in' }, at + 0.16)
          .to(zones[i], { autoAlpha: 1, duration: 0.14, ease: 'none' }, at + 0.24)
          .to(zones[i], { scale: 1, yPercent: 0, duration: 0.62, ease: E.out }, at + 0.24)
          // На смене кадр открывается: затемнение уходит с 60 % до 45 %
          // и возвращается, когда проём прошёл и текст снова читается.
          .to(scrims, { opacity: SCRIM_OPEN, duration: 0.3, ease: 'none' }, at)
          .to(scrims, { opacity: SCRIM, duration: 0.42, ease: 'none' }, at + 0.5)
      }
    }, el)

    return () => ctx.revert()
  }, [])

  return (
    <section className="sec zones on-dark sc-next" id="kompleks" ref={root} aria-label="Комплекс">
      {ZONES.map((z, i) => (
        <article className="zone" key={z.name}>
          {/* Кадр зоны на весь экран. На узком экране тот же файл даёт
              центральный кроп — отдельных мобильных кадров нет. */}
          <picture className="zone__img">
            <source
              type="image/avif"
              sizes="100vw"
              srcSet={`${A(`/img/${z.img}-1600.avif`)} 1600w, ${A(`/img/${z.img}-2400.avif`)} 2400w`}
            />
            <source
              type="image/webp"
              sizes="100vw"
              srcSet={`${A(`/img/${z.img}-1600.webp`)} 1600w, ${A(`/img/${z.img}-2400.webp`)} 2400w`}
            />
            <img
              src={A(`/img/${z.img}.jpg`)}
              alt=""
              width={2752}
              height={1536}
              decoding="async"
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : 'low'}
            />
          </picture>
          <div className="zone__scrim" aria-hidden="true" />

          <div className="zone__in">
            <div className="zone__top">
              <p className="eyebrow">Комплекс</p>
              {/* Счётчик здесь несёт смысл: скролл — это проход внутрь,
                  и знать, где ты в этом проходе, нужно. */}
              <p className="zone__count">
                Зона {i + 1} из {ZONES.length}
              </p>
            </div>

            <div className="zone__mid">
              <h2 className="zone__name">{z.name}</h2>
              <p className="temp zone__temp">
                {z.temp}
                <sup>°</sup>
              </p>
            </div>

            <div className="zone__bottom">
              <p className="zone__note">{z.note}</p>
              <p className="zone__detail">{z.detail}</p>
            </div>
          </div>
        </article>
      ))}

      <div className="door" aria-hidden="true" />

      <div className="zones__idx" aria-hidden="true">
        {ZONES.map((z) => (
          <i key={z.name} data-on="0" />
        ))}
      </div>
    </section>
  )
}
