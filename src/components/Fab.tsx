'use client'

import { useEffect, useRef } from 'react'

/**
 * Плавающая кнопка записи. Появляется, как только герой ушёл из кадра,
 * и держится до самой формы — правило «кнопка всегда в поле зрения».
 */
export function Fab() {
  const ref = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const form = document.getElementById('zapis')
        const past = window.scrollY > window.innerHeight * 0.8
        const atForm = form ? form.getBoundingClientRect().top < window.innerHeight * 0.9 : false
        el.dataset.on = past && !atForm ? '1' : '0'
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <a className="btn fab" href="#zapis" ref={ref} data-on="0">
      <span>Записаться</span>
    </a>
  )
}
