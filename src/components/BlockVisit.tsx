'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { A } from '@/lib/asset'
import { STEPS } from '@/lib/content'
import { E, reduced } from '@/lib/motion'

/** Тон сцены на каждом шаге: холодный серо-голубой → янтарный → синий. */
const TONES = ['#5b686e', '#6d6154', '#6b4b2e', '#2c4657']

/** Капли: позиция, длина, скорость. Значения фиксированы — не случайны,
 *  иначе SSR и клиент разъезжаются, а кадр перестаёт быть повторяемым. */
const DROPS = [
  { x: 8, len: 74, dur: 3.4, delay: 0.0 },
  { x: 17, len: 46, dur: 4.6, delay: 1.7 },
  { x: 26, len: 104, dur: 2.9, delay: 0.8 },
  { x: 41, len: 58, dur: 4.1, delay: 2.4 },
  { x: 55, len: 88, dur: 3.2, delay: 0.4 },
  { x: 68, len: 40, dur: 5.0, delay: 1.2 },
  { x: 79, len: 96, dur: 3.6, delay: 2.9 },
  { x: 88, len: 52, dur: 4.4, delay: 0.6 },
  { x: 95, len: 68, dur: 3.1, delay: 2.1 },
]

/**
 * Блок 2 — Визит. Главное погружение: экран становится парной.
 *
 * Всё, что меняется по скроллу, меняется прозрачностью и transform.
 * Цвет сцены — четыре готовых полотна с перекрёстным гашением,
 * а не анимация background-color: заливка всего экрана краской
 * каждый кадр — это перерисовка, которой здесь быть не должно.
 */
export function BlockVisit() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const q = gsap.utils.selector(el)
    const steps = q<HTMLElement>('.visit__step')
    const tones = q<HTMLElement>('.visit__tone')
    const fog = q<HTMLElement>('.visit__fog')
    const venik = q<HTMLElement>('.venik')[0]
    const drops = q<HTMLElement>('.dropwrap')

    // Шаги разворачиваются в список средствами CSS — см. @media
    // (prefers-reduced-motion).
    if (reduced()) return

    const ctx = gsap.context(() => {
      // Капли идут своим циклом, независимо от скролла.
      drops.forEach((w, i) => {
        const d = DROPS[i]
        const drop = w.querySelector<HTMLElement>('.drop')!
        const track = w.querySelector<HTMLElement>('.drop-track')!
        gsap.set(track, { scaleY: 0, transformOrigin: '50% 0%' })
        gsap
          .timeline({ repeat: -1, delay: d.delay })
          .fromTo(
            drop,
            { yPercent: 0 },
            { yPercent: 1180, duration: d.dur, ease: E.drop },
            0,
          )
          .fromTo(track, { scaleY: 0 }, { scaleY: 1, duration: d.dur, ease: E.drop }, 0)
          .to(track, { autoAlpha: 0, duration: 1.1, ease: 'power1.out' }, d.dur)
          .set(track, { autoAlpha: 1, scaleY: 0 })
      })

      gsap.set(steps.slice(1), { autoAlpha: 0, yPercent: 8 })
      gsap.set(tones.slice(1), { autoAlpha: 0 })
      gsap.set(drops, { autoAlpha: 0 })


      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: `+=${(STEPS.length - 1) * 110}%`,
          pin: true,
          scrub: 0.55,
          anticipatePin: 1,
        },
      })

      // Температура: растёт до 90, затем резко падает до 4 на купели.
      for (let i = 1; i < STEPS.length; i++) {
        const at = i - 1
        tl.to(steps[i - 1], { autoAlpha: 0, yPercent: -8, duration: 0.5, ease: 'power2.in' }, at + 0.18)
          .fromTo(
            steps[i],
            { autoAlpha: 0, yPercent: 8 },
            { autoAlpha: 1, yPercent: 0, duration: 0.62, ease: E.out },
            at + 0.34,
          )
          .to(tones[i], { autoAlpha: 1, duration: 0.8, ease: 'none' }, at + 0.1)
      }

      // Запотевание нарастает по краям кадра — только прозрачность.
      tl.fromTo(fog, { autoAlpha: 0.06 }, { autoAlpha: 0.7, duration: 2.2, ease: 'none' }, 0)
        // Прозрачность выводится на самих дорожках, а не на группе:
        // анимация alpha у полноэкранной группы заставляет браузер
        // сводить всё её содержимое в отдельный буфер каждый кадр.
        .fromTo(drops, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, ease: 'none' }, 0.4)
        // Веник входит слева на третьем шаге и уходит.
        // x/y обнуляются явно: стартовое положение описано в CSS
        // процентным translate, и без этого GSAP оставил бы его
        // поверх анимации xPercent — веник не вышел бы в кадр.
        .fromTo(
          venik,
          { xPercent: -125, yPercent: -46, rotate: -16, x: 0, y: 0 },
          { xPercent: -24, yPercent: -50, rotate: -4, x: 0, y: 0, duration: 0.55, ease: E.out },
          2.02,
        )
        .to(venik, { xPercent: -128, rotate: -18, duration: 0.5, ease: 'power2.in' }, 2.74)
    }, el)

    return () => ctx.revert()
  }, [])

  return (
    <section className="sec visit on-dark" id="vizit" ref={root} aria-label="Визит">
      <div className="visit__tones" aria-hidden="true">
        {TONES.map((c) => (
          <div className="visit__tone" key={c} style={{ background: c }} />
        ))}
      </div>

      <img className="visit__fog" src={A('/img/fog.webp')} alt="" aria-hidden="true" loading="lazy" decoding="async" />

      <div className="visit__drops" aria-hidden="true">
        {DROPS.map((d, i) => (
          <span className="dropwrap" key={i} style={{ left: `${d.x}%` }}>
            <i className="drop-track" />
            <i className="drop" style={{ height: d.len }} />
          </span>
        ))}
      </div>

      <Venik />

      <div className="visit__steps">
        {STEPS.map((s) => (
          <article className="visit__step" key={s.n}>
            <div className="visit__in">
              <span className="visit__n">Шаг {s.n}</span>
              <h2 className="visit__name">{s.name}</h2>
              <p className="visit__note">{s.note}</p>
              <p className="visit__detail">{s.detail}</p>
            </div>
          </article>
        ))}
      </div>

    </section>
  )
}

/**
 * Силуэт веника. Рисуется разметкой: присланных кадров всего два,
 * фотографии веника среди них нет, а заглушек в макете не бывает.
 *
 * Веер листьев расходится от перевязи; каждый лист — миндалевидная
 * кривая со своим углом и длиной, поэтому пучок читается как пучок,
 * а не как облако.
 */
function Venik() {
  // угол в градусах, длина, ширина, сдвиг основания вдоль ручки
  const leaves: [number, number, number, number][] = [
    [-56, 62, 34, 6], [-46, 78, 38, 2], [-36, 92, 41, 4], [-27, 102, 43, 0],
    [-18, 108, 44, 2], [-9, 112, 45, 0], [0, 111, 45, 3], [9, 106, 44, 1],
    [18, 98, 42, 2], [27, 86, 39, 4], [37, 72, 35, 1], [48, 58, 30, 6],
    [-32, 66, 30, 20], [-15, 78, 32, 22], [3, 77, 32, 21], [21, 65, 30, 19],
    [-40, 48, 24, 36], [-7, 53, 26, 38], [22, 46, 24, 35],
  ]

  const leaf = (deg: number, len: number, wid: number, off: number) => {
    const a = (deg * Math.PI) / 180
    const cx = Math.cos(a)
    const cy = Math.sin(a)
    const px = -cy
    const py = cx
    const bx = off * cx
    const by = off * cy
    const tx = bx + len * cx
    const ty = by + len * cy
    const m1x = bx + len * 0.45 * cx + wid * px
    const m1y = by + len * 0.45 * cy + wid * py
    const m2x = bx + len * 0.45 * cx - wid * px
    const m2y = by + len * 0.45 * cy - wid * py
    const r = (n: number) => n.toFixed(1)
    return `M ${r(bx)} ${r(by)} Q ${r(m1x)} ${r(m1y)} ${r(tx)} ${r(ty)} Q ${r(m2x)} ${r(m2y)} ${r(bx)} ${r(by)} Z`
  }

  return (
    <svg className="venik" viewBox="0 0 300 300" fill="none" aria-hidden="true">
      <g transform="translate(126 150)">
        <g fill="currentColor" opacity="0.5">
          {leaves.map((l, i) => (
            <path key={i} d={leaf(l[0], l[1], l[2], l[3])} />
          ))}
        </g>
        <path
          d="M 0 0 L -112 0"
          stroke="currentColor"
          strokeWidth="11"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M -44 -9 L -44 9 M -60 -8 L -60 8"
          stroke="currentColor"
          strokeWidth="4"
          opacity="0.45"
        />
      </g>
    </svg>
  )
}
