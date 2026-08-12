'use client'

import { useEffect } from 'react'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { reduced } from '@/lib/motion'

/**
 * Мастер-таймлайн страницы.
 *
 * Один драйвер, привязанный к прогрессу скролла всего полотна, а не набор
 * независимых триггеров по секциям. Он ведёт две вещи: уход сцены героя
 * в своей доле прокрутки и непрерывный перегон фона по всей длине.
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
    if (reduced()) return

    const layers = gsap.utils.toArray<HTMLElement>('.backdrop i')
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
      //
      // Пара, который раньше был связующим веществом между сценами,
      // больше нет. Переход собран на том, что осталось в кадре:
      // движение содержимого, масштаб фотографии и свет.
      //
      // Порядок важен и разведён по времени. Сначала уходит набор — по
      // строкам, снизу вверх, с тем же сдвигом, что и на входе. Потом
      // фотография отступает вглубь и растворяется. Следующая сцена
      // всё это время уже лежит на своём месте и только набирает
      // непрозрачность — она не выезжает из-под низа, поэтому кромки,
      // которая читалась бы швом, физически не возникает.

      // Строки заголовка уходят первыми, каждая своим темпом.
      master.fromTo(
        '.hero__title .ln > i',
        { yPercent: 0, opacity: 1 },
        { yPercent: -132, opacity: 0, duration: hf * 0.34, stagger: hf * 0.05 },
        0,
      )

      // Нижняя строка снимается сразу: она мелкая, и тянуть её незачем.
      master.fromTo(
        '.hero__foot',
        { yPercent: 0, opacity: 1 },
        { yPercent: 40, opacity: 0, duration: hf * 0.26 },
        0,
      )

      // Фотография отступает вглубь. Масштаб небольшой: кадр обязан
      // остаться кадром, а не уехать в зум.
      master.fromTo(
        '.hero__bg',
        { scale: 1, yPercent: 0 },
        { scale: 1.1, yPercent: -4, duration: hf },
        0,
      )

      // Вода уходит раньше фотографии. Иначе последним, что видно в
      // кадре, остаётся прямоугольник холста — его кромка и есть шов.
      master.fromTo(
        '.water',
        { opacity: 1 },
        { opacity: 0, duration: hf * 0.2 },
        hf * 0.42,
      )

      // Фотография растворяется до того, как липкая площадка отлипнет.
      // Иначе её нижняя кромка выезжает ровной чертой во всю ширину.
      master.fromTo(
        '.hero__bg',
        { opacity: 1 },
        { opacity: 0, duration: hf * 0.3 },
        hf * 0.58,
      )

      // Следующая сцена проявляется на месте.
      master.fromTo(
        '.sc-next',
        { opacity: 0 },
        { opacity: 1, duration: hf * 0.34 },
        hf * 0.6,
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
