'use client'

import { useEffect, useRef } from 'react'
import { BRAND, NAV } from '@/lib/content'

/**
 * Шапка: вордмарк и разделы, больше ничего. Телефон и кнопка убраны —
 * в герое запись держат две кнопки в текстовом блоке, ниже героя её
 * подхватывает плавающая кнопка, так что точка входа из виду не уходит.
 */
export function Header() {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        el.dataset.stuck = window.scrollY > window.innerHeight * 0.72 ? '1' : '0'
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <header className="hdr" ref={ref} data-stuck="0">
      <div className="hdr__in">
        {/* Вордмарк в шапке не гаснет на входе. Это якорь кадра — и
            единственный текст, отрисованный в первом же кадре: без него
            браузеру нечего засчитать как основное содержимое страницы,
            и метрика LCP уезжает на секунды вперёд. */}
        <a className="hdr__mark" href="#top" aria-label={`${BRAND} — наверх`}>
          {BRAND}
        </a>

        <nav className="hdr__nav" aria-label="Разделы">
          {NAV.map((n) => (
            <a className="hdr__link js-in" key={n.id} href={`#${n.id}`}>
              {n.label}
            </a>
          ))}
        </nav>

      </div>
    </header>
  )
}
