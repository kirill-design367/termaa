'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { TARIFFS } from '@/lib/content'
import { E, reduced } from '@/lib/motion'

/**
 * Блок 3 — Цены. Не таблица, а три термометра.
 *
 * Скролл поднимает уровень в каждом столбе снизу вверх; по мере подъёма
 * проступают строки состава, а цена появляется в вершине, когда столб
 * дошёл до верха. Столбы разной высоты: чем дороже, тем выше.
 */
export function BlockPrices() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const q = gsap.utils.selector(el)
    const cols = q<HTMLElement>('.col')

    // Налитые столбы и видимый состав — в CSS, ветка reduced-motion.
    if (reduced()) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: q('.cols')[0],
          start: 'top 82%',
          end: 'bottom 72%',
          scrub: 0.8,
        },
      })

      cols.forEach((col, i) => {
        const fill = col.querySelector('.col__fill')!
        const rows = Array.from(col.querySelectorAll('.col__rows li'))
        const cap = col.querySelector('.col__cap')!
        const at = i * 0.12

        tl.fromTo(fill, { scaleY: 0 }, { scaleY: 1, duration: 1, ease: 'none' }, at)
          .fromTo(
            rows,
            { opacity: 0, y: 12 },
            { opacity: 1, y: 0, duration: 0.34, ease: E.out, stagger: 0.62 / rows.length },
            at + 0.08,
          )
          .fromTo(cap, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: E.out }, at + 0.9)
      })
    }, el)

    return () => ctx.revert()
  }, [])

  return (
    <section className="sec prices on-light" id="tseny" ref={root}>
      <div className="wrap">
        <header className="sec__head">
          <h2 className="h2">Цены</h2>
          <p className="eyebrow">Три тарифа, всё включено</p>
        </header>

        <div className="cols">
          {TARIFFS.map((t) => (
            <div className="col" key={t.id}>
              <div
                className="col__tube"
                style={{ ['--h' as string]: t.height }}
                role="group"
                aria-label={`Тариф «${t.name}», ${t.price} рублей`}
              >
                <div className="col__fill" aria-hidden="true" />
                <div className="col__cap">
                  <span className="col__price">
                    {t.price}
                    <em>₽</em>
                  </span>
                </div>
                <ul className="col__rows">
                  {t.includes.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="col__name">{t.name}</h3>
                <p className="col__sum">{t.summary}</p>
              </div>

              <a className="btn btn--dark btn--wide" href="#zapis">
                <span>Записаться</span>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
