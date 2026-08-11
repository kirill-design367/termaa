'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { A } from '@/lib/asset'
import { D, E, reduced } from '@/lib/motion'
import { SteamVolume } from './SteamVolume'

/**
 * Пар героя. Три испечённых тира плотности лежат НАД вордмарком —
 * отсюда глубина: слово уходит в пар, а не лежит на нём.
 *
 * Приём с курсором: из двух плотных тиров вычитается мягкий круг
 * (mask-composite: subtract). Радиус и центр — CSS-переменные, их
 * пишет один цикл в тикере GSAP. Ни одного анимируемого фильтра:
 * круг описан градиентом заранее, blur испечён на сборке.
 */
/**
 * Доля радиуса по тирам. Маскируются только два верхних:
 * маска — единственная операция здесь, которая заставляет браузер
 * перерисовывать слой, и платить за неё трижды за один и тот же
 * кадр незачем. Нижняя дымка остаётся целой — она и должна остаться.
 */
const CUT = [0.68, 1]

export function Steam() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const box = ref.current
    if (!box) return
    const layers = Array.from(box.querySelectorAll<HTMLImageElement>('.steam__l'))
    const cuts = Array.from(box.querySelectorAll<HTMLImageElement>('.steam__l--cut'))
    const hero = box.closest('.hero') as HTMLElement | null
    if (!hero) return

    const soft = reduced()

    // ── Дыхание: медленный цикл 8 секунд, только transform. ─────────
    let breath: gsap.core.Tween | null = null
    if (!soft) {
      breath = gsap.to(layers, {
        scale: 1.055,
        duration: 8,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        stagger: { each: 1.4, from: 'start' },
      })
    }

    // ── Параллакс фона и пара по курсору, амплитуда до 12 px. ───────
    const bg = hero.querySelector('.hero__bg') as HTMLElement | null
    const pxBg = bg ? gsap.quickTo(bg, 'x', { duration: 0.9, ease: 'power2.out' }) : null
    const pyBg = bg ? gsap.quickTo(bg, 'y', { duration: 0.9, ease: 'power2.out' }) : null
    const pxSt = gsap.quickTo(layers, 'x', { duration: 1.1, ease: 'power2.out' })
    const pySt = gsap.quickTo(layers, 'y', { duration: 1.1, ease: 'power2.out' })

    // ── Прочистка под курсором. ─────────────────────────────────────
    const st = { x: 0, y: 0, r: 0.5 }
    let tx = 0
    let ty = 0
    let first = true
    let rTween: gsap.core.Tween | null = null

    const RADIUS = () => Math.min(520, Math.max(300, window.innerWidth * 0.235))

    const write = () => {
      // Позиция догоняет курсор с задержкой — пар вязкий, а не резиновый.
      st.x += (tx - st.x) * (first ? 1 : 0.17)
      st.y += (ty - st.y) * (first ? 1 : 0.17)
      first = false
      const x = st.x.toFixed(1) + 'px'
      const y = st.y.toFixed(1) + 'px'
      // Радиус разный по тирам — прочистка получается ступенчатой,
      // с мягким ореолом по краю, а не круглой дыркой.
      for (let i = 0; i < cuts.length; i++) {
        cuts[i].style.setProperty('--hx', x)
        cuts[i].style.setProperty('--hy', y)
        cuts[i].style.setProperty('--hr', (st.r * CUT[i]).toFixed(1) + 'px')
      }
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = box.getBoundingClientRect()
      tx = e.clientX - r.left
      ty = e.clientY - r.top

      // Параллакс: −1…1 от центра экрана.
      const nx = (e.clientX / window.innerWidth - 0.5) * 2
      const ny = (e.clientY / window.innerHeight - 0.5) * 2
      pxBg?.(-nx * 12)
      pyBg?.(-ny * 12)
      pxSt(-nx * 7)
      pySt(-ny * 5)

      if (st.r < 1) {
        rTween?.kill()
        rTween = gsap.to(st, { r: RADIUS(), duration: D.m, ease: E.steam })
      }
    }

    const onLeave = () => {
      rTween?.kill()
      // Пар затягивается обратно ровно за 1.2 секунды.
      rTween = gsap.to(st, { r: 0.5, duration: D.l, ease: E.steam })
      pxBg?.(0)
      pyBg?.(0)
      pxSt(0)
      pySt(0)
    }

    if (!soft && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      hero.addEventListener('pointermove', onMove, { passive: true })
      hero.addEventListener('pointerleave', onLeave)
      gsap.ticker.add(write)
    }

    return () => {
      hero.removeEventListener('pointermove', onMove)
      hero.removeEventListener('pointerleave', onLeave)
      gsap.ticker.remove(write)
      rTween?.kill()
      breath?.kill()
    }
  }, [])

  return (
    <>
      {/* Объёмный пар. Если он поднялся — испечённые полосы ниже гаснут
          по метке data-gl на герое; если нет, работают они. */}
      <SteamVolume />
      <div className="steam" ref={ref} aria-hidden="true">
      {['steam-1', 'steam-2', 'steam-3'].map((n, i) => (
        <img
          key={n}
          className={`steam__l${i > 0 ? ' steam__l--cut' : ''}`}
          src={A(`/img/${n}.webp`)}
          srcSet={`${A(`/img/${n}-1200.webp`)} 1200w, ${A(`/img/${n}.webp`)} 2400w`}
          sizes="(max-width: 860px) 280vw, 112vw"
          alt=""
          decoding="async"
        />
      ))}
      </div>
    </>
  )
}
