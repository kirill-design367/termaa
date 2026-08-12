'use client'

import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { ZONES } from '@/lib/content'
import { E, reduced } from '@/lib/motion'

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
        tl.fromTo(door, { xPercent: -130 }, { xPercent: 130, duration: 0.62, ease: E.door }, at)
          .to(zones[i - 1], { scale: 0.9, duration: 0.6, ease: 'power2.in' }, at + 0.16)
          .to(zones[i], { autoAlpha: 1, duration: 0.14, ease: 'none' }, at + 0.24)
          .to(zones[i], { scale: 1, yPercent: 0, duration: 0.62, ease: E.out }, at + 0.24)
      }
    }, el)

    return () => ctx.revert()
  }, [])

  return (
    <section className="sec zones on-dark sc-next" id="kompleks" ref={root} aria-label="Комплекс">
      {ZONES.map((z, i) => (
        <article className="zone" key={z.name}>
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
