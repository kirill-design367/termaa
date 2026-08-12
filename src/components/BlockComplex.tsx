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
 * предыдущей и уходит вглубь, а не вбок — это движение вперёд, а не
 * карусель. Проходящего по кадру элемента нет: смену делают только
 * текст и изображение.
 *
 * Смена разведена по времени, а не идёт всем сразу. Порядок жёсткий:
 * сначала уходит текст уходящей зоны, потом под проёмом меняется кадр,
 * и только потом приходит текст новой. Двух текстов в кадре не бывает
 * ни в один момент — раньше они читались одновременно и задваивались.
 */
export function BlockComplex() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const q = gsap.utils.selector(el)
    const zones = q<HTMLElement>('.zone')
    const ins = q<HTMLElement>('.zone__in')
    const scrims = q<HTMLElement>('.zone__scrim')

    // Без движения зоны разворачиваются в список — это описано в CSS,
    // в @media (prefers-reduced-motion). Скрипту тут делать нечего.
    if (reduced()) return

    gsap.set(zones.slice(1), { autoAlpha: 0, scale: 1.12 })
    gsap.set(ins.slice(1), { autoAlpha: 0, y: 24 })

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: `+=${(ZONES.length - 1) * 100}%`,
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
        },
      })

      for (let i = 1; i < zones.length; i++) {
        const at = i - 1

        // 1. Текст уходящей зоны уходит первым и до конца.
        tl.to(ins[i - 1], { autoAlpha: 0, y: -24, duration: 0.2, ease: 'power2.in' }, at)

        // 2. Кадр меняется, когда текста в кадре уже нет. Проходящего
        //    элемента больше нет: смену делают только текст и кадр.
        tl.to(zones[i - 1], { autoAlpha: 0, duration: 0.16, ease: 'none' }, at + 0.3)
          .to(zones[i], { autoAlpha: 1, duration: 0.16, ease: 'none' }, at + 0.3)
          .to(zones[i], { scale: 1, duration: 0.62, ease: E.out }, at + 0.3)

        // 3. Текст новой зоны приходит последним.
        tl.to(ins[i], { autoAlpha: 1, y: 0, duration: 0.26, ease: 'power2.out' }, at + 0.58)

        // На смене кадр открывается: затемнение уходит с 60 % до 45 %
        // и возвращается, когда текст снова читается.
        tl.to(scrims, { opacity: SCRIM_OPEN, duration: 0.26, ease: 'none' }, at + 0.16)
          .to(scrims, { opacity: SCRIM, duration: 0.32, ease: 'none' }, at + 0.56)
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
            <div className="zone__mid">
              <h2 className="zone__name">{z.name}</h2>
            </div>

            <div className="zone__bottom">
              <div>
                {/* Температура — строкой рядом с описанием, кеглем
                    интерфейса и белым. Огромной цифры и акцента нет. */}
                <p className="zone__temp">{z.temp}°</p>
                <p className="zone__note">{z.note}</p>
              </div>
              <p className="zone__detail">{z.detail}</p>
            </div>
          </div>
        </article>
      ))}

    </section>
  )
}
