'use client'

import { useEffect } from 'react'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { reduced } from '@/lib/motion'
import { setHeroProgress } from '@/lib/scene'

/**
 * Мастер-таймлайн страницы.
 *
 * Один драйвер, привязанный к прогрессу скролла всего полотна, а не набор
 * независимых триггеров по секциям. Он ведёт две вещи: развитие сцены
 * героя в своей доле прокрутки и непрерывный перегон фона по всей длине.
 *
 * Фон никогда не перекрашивается: готовые состояния лежат стопкой и
 * перегоняются непрозрачностью. Поэтому тональной ступени между сценами
 * не возникает физически — переход всегда идёт через смешение.
 */
export function Scene() {
  useEffect(() => {
    const page = document.querySelector('.page') as HTMLElement | null
    const hero = document.querySelector('.hero') as HTMLElement | null
    if (!page || !hero) return

    // В режиме покоя мастер-таймлайн не строится: сцена героя
    // разворачивается в обычный поток документа, фон стоит на первом
    // состоянии. Конечные состояния прописаны в CSS.
    if (reduced()) {
      setHeroProgress(0)
      return
    }

    const layers = gsap.utils.toArray<HTMLElement>('.backdrop i')
    const proxy = { p: 0 }
    let master: gsap.core.Timeline | null = null

    const build = () => {
      master?.scrollTrigger?.kill()
      master?.kill()

      // Доля прокрутки, которую занимает сцена героя. Считается от живой
      // геометрии, поэтому смена высоты экрана её не ломает.
      const total = Math.max(1, page.offsetHeight - window.innerHeight)
      const heroLen = Math.max(1, hero.offsetHeight - window.innerHeight)
      const hf = Math.min(0.98, heroLen / total)

      master = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: page,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.45,
        },
      })

      // ── Сцена героя ────────────────────────────────────────────────
      master.fromTo(
        proxy,
        { p: 0 },
        {
          p: 1,
          duration: hf,
          onUpdate: () => setHeroProgress(proxy.p),
        },
        0,
      )

      // Фотография уходит вглубь: масштаб и лёгкий подъём.
      master.fromTo(
        '.hero__bg',
        { scale: 1, yPercent: 0 },
        { scale: 1.16, yPercent: -5, duration: hf },
        0,
      )

      // Текстовый блок поднимается и растворяется раньше вордмарка.
      master.fromTo(
        '.hero__copy',
        { yPercent: 0, opacity: 1 },
        { yPercent: -26, opacity: 0, duration: hf * 0.5 },
        0,
      )

      // Разметочный вордмарк идёт следом. Живой объём поднимает и
      // растворяет слово сам — этот путь для отката.
      master.fromTo(
        '.wm',
        { yPercent: 0, opacity: 1 },
        { yPercent: -32, opacity: 0, duration: hf * 0.48 },
        hf * 0.44,
      )

      // Испечённый поток усиливается вместе с объёмным.
      master.fromTo(
        '.hero__stage .flow',
        { opacity: 1, scale: 1 },
        { opacity: 1.35, scale: 1.18, duration: hf },
        0,
      )

      // Следующая сцена проявляется сквозь пар, а не выезжает из-под низа:
      // она уже лежит на своём месте и только набирает непрозрачность.
      master.fromTo(
        '.sc-next',
        { opacity: 0 },
        { opacity: 1, duration: hf * 0.34 },
        hf * 0.62,
      )

      // ── Непрерывный перегон фона по всей длине полотна ─────────────
      // Состояний четыре, переходы перекрываются: в любой точке скролла
      // видно смешение двух соседних, а не ступень.
      const stops = [0, 0.3, 0.58, 0.82]
      layers.forEach((el, i) => {
        gsap.set(el, { opacity: i === 0 ? 1 : 0 })
        if (i === 0) return
        master!.to(el, { opacity: 1, duration: 0.26 }, stops[i])
      })
    }

    build()
    ScrollTrigger.addEventListener('refreshInit', build)
    return () => {
      ScrollTrigger.removeEventListener('refreshInit', build)
      master?.scrollTrigger?.kill()
      master?.kill()
    }
  }, [])

  return (
    <div className="backdrop" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </div>
  )
}
