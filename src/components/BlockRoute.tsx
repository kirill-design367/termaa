'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from '@/lib/gsap'
import { HOURS, PHONE, PHONE_HREF, ROUTE } from '@/lib/content'
import { reduced } from '@/lib/motion'

/**
 * Схема проезда: трасса → развилка → серпантин → ворота.
 * Два начертания одной дороги: широкая горизонтальная и узкая
 * вертикальная. На 390 px горизонтальная сжимается до 150 px высоты,
 * и подписи перестают читаться — это не сжатый десктоп, а другой кадр.
 */
const MAPS = {
  wide: {
    box: '0 0 720 300',
    d:
      'M 40 250 C 130 250 150 214 214 206 C 286 197 300 158 372 150 ' +
      'C 452 141 456 96 528 88 C 590 81 606 52 672 46',
    dots: [
      { x: 40, y: 250, dx: 0, dy: -18, anchor: 'start' },
      { x: 214, y: 206, dx: 0, dy: -18, anchor: 'start' },
      { x: 372, y: 150, dx: 0, dy: -18, anchor: 'start' },
      { x: 672, y: 46, dx: 0, dy: -18, anchor: 'end' },
    ],
    font: 9,
  },
  tall: {
    box: '0 0 300 560',
    d:
      'M 44 34 C 44 104 128 112 138 176 C 149 244 60 258 68 326 ' +
      'C 76 396 196 392 216 462 C 226 500 238 514 254 522',
    dots: [
      { x: 44, y: 34, dx: 16, dy: 5, anchor: 'start' },
      { x: 138, y: 176, dx: 16, dy: 5, anchor: 'start' },
      { x: 68, y: 326, dx: 16, dy: 5, anchor: 'start' },
      { x: 254, y: 522, dx: -16, dy: 5, anchor: 'end' },
    ],
    font: 13,
  },
} as const

export function BlockRoute() {
  const root = useRef<HTMLElement>(null)
  const [map, setMap] = useState<'wide' | 'tall'>('wide')

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)')
    const sync = () => setMap(mq.matches ? 'tall' : 'wide')
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const q = gsap.utils.selector(el)
    const line = q<SVGPathElement>('.route__line')[0]
    const dots = q<SVGElement>('.route__dot')
    const labels = q<SVGElement>('.route__label')
    if (reduced()) return

    const len = line.getTotalLength()
    gsap.set(line, { strokeDasharray: len, strokeDashoffset: len })
    gsap.set([dots, labels], { opacity: 0 })

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: 'top 74%', end: 'bottom 78%', scrub: 0.7 },
      })
      tl.to(line, { strokeDashoffset: 0, duration: 1, ease: 'none' }, 0)
      dots.forEach((d, i) => {
        const at = (i / (dots.length - 1)) * 0.94
        tl.to([d, labels[i]], { opacity: 1, duration: 0.08, ease: 'power2.out' }, at)
      })
    }, el)

    return () => ctx.revert()
  }, [map])

  return (
    <section className="sec route on-dark" id="kontakty" ref={root}>
      <div className="wrap">
        <header className="sec__head">
          <h2 className="h2">Как добраться</h2>
          <p className="eyebrow">{ROUTE.drive}</p>
        </header>

        <div className="route__grid" style={{ paddingTop: 'clamp(28px,5vh,64px)' }}>
          <svg
            className="route__map"
            key={map}
            viewBox={MAPS[map].box}
            role="img"
            aria-label={`Схема проезда: ${ROUTE.points.map((p) => p.label).join(' — ')}`}
          >
            <path className="route__line" d={MAPS[map].d} />
            {MAPS[map].dots.map((d, i) => (
              <circle
                key={i}
                className={`route__dot${i === MAPS[map].dots.length - 1 ? ' route__dot--end' : ''}`}
                cx={d.x}
                cy={d.y}
                r={i === MAPS[map].dots.length - 1 ? 7 : 5}
              />
            ))}
            {MAPS[map].dots.map((d, i) => (
              <text
                key={i}
                className="route__label"
                x={d.x + d.dx}
                y={d.y + d.dy}
                fontSize={MAPS[map].font}
                textAnchor={d.anchor}
              >
                {ROUTE.points[i].label}
              </text>
            ))}
          </svg>

          <dl className="route__facts">
            <div className="route__fact">
              <dt>Адрес</dt>
              <dd>
                {ROUTE.address}
                <br />
                {ROUTE.region}
              </dd>
            </div>
            <div className="route__fact">
              <dt>Координаты</dt>
              <dd>{ROUTE.coords}</dd>
            </div>
            <div className="route__fact">
              <dt>Часы работы</dt>
              <dd>Ежедневно {HOURS.replace('с ', 'с ').replace(', без выходных', '')}</dd>
            </div>
            <div className="route__fact">
              <dt>Телефон</dt>
              <dd>
                <a href={PHONE_HREF}>{PHONE}</a>
              </dd>
            </div>
            <div className="route__fact">
              <dt>Дорога</dt>
              <dd>{ROUTE.drive}</dd>
            </div>
          </dl>
        </div>

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 'clamp(28px,5vh,56px) 0 0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--gut)',
            borderTop: '1px solid var(--rule)',
            paddingTop: 'clamp(20px,3vh,34px)',
          }}
        >
          {ROUTE.points.map((p) => (
            <li key={p.id}>
              <p className="eyebrow" style={{ marginBottom: '0.7em' }}>
                {p.label}
              </p>
              <p style={{ margin: 0, color: 'var(--fg-dim)' }}>{p.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
