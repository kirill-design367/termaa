'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { REVIEWS } from '@/lib/content'
import { reduced } from '@/lib/motion'

/**
 * Блок 4 — Отзывы. Карточки плывут как в воде: покачивание по синусоиде,
 * у каждой своя фаза, амплитуда до 8 px. Листание — скроллом страницы,
 * стрелок нет.
 */
export function BlockReviews() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const q = gsap.utils.selector(el)
    const track = q<HTMLElement>('.revs__track')[0]
    const cards = q<HTMLElement>('.rev')

    if (reduced()) return

    const ctx = gsap.context(() => {
      // Покачивание: у каждой карточки своя фаза и свой период.
      cards.forEach((c, i) => {
        gsap.to(c, {
          y: 8 - (i % 3) * 2,
          duration: 3.2 + i * 0.45,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: i * 0.6,
        })
      })

      // Перетекание вбок привязано к скроллу страницы.
      const overflow = () => Math.max(0, track.scrollWidth - window.innerWidth + 24)
      gsap.fromTo(
        track,
        { x: 0 },
        {
          x: () => -overflow(),
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top 42%',
            end: 'bottom 92%',
            scrub: 0.7,
            invalidateOnRefresh: true,
          },
        },
      )
    }, el)

    return () => ctx.revert()
  }, [])

  return (
    <section className="sec revs on-dark" ref={root} aria-label="Отзывы">
      <div className="wrap">
        <header className="sec__head" style={{ borderBottom: 0, paddingBlock: 0 }}>
          <h2 className="h2">Отзывы</h2>
          <p className="eyebrow">Оставлены после визита</p>
        </header>
      </div>

      <div className="revs__track">
        {REVIEWS.map((r) => (
          <blockquote className="rev" key={r.name}>
            <p>{r.text}</p>
            <footer>
              <span>{r.name}</span>
              <span aria-hidden="true">—</span>
              <span>{r.month}</span>
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  )
}
