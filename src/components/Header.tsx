'use client'

import { useEffect, useRef } from 'react'
import { BRAND, NAV, PHONE, PHONE_HREF } from '@/lib/content'

/**
 * Шапка. Кнопка «Записаться» здесь живёт постоянно и не уезжает
 * ни в одном блоке — это единственная точка входа в запись сверху.
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

        <div className="hdr__right">
          <a className="hdr__tel js-in" href={PHONE_HREF}>
            {PHONE}
          </a>
          <a className="hdr__call js-in" href={PHONE_HREF} aria-label={`Позвонить, ${PHONE}`}>
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none">
              <path
                d="M6.2 3.6h3.1l1.5 3.8-2 1.3a12 12 0 0 0 5.5 5.5l1.3-2 3.8 1.5v3.1c0 .9-.7 1.6-1.6 1.6A15.6 15.6 0 0 1 4.6 5.2c0-.9.7-1.6 1.6-1.6Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <a className="btn js-in" href="#zapis">
            <span>Записаться</span>
          </a>
        </div>
      </div>
    </header>
  )
}
