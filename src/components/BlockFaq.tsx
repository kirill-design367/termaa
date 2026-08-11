'use client'

import { useState } from 'react'
import { A } from '@/lib/asset'
import { FAQ } from '@/lib/content'

/**
 * Блок 5 — Вопросы.
 *
 * Ответ не выезжает вниз, а проступает сквозь конденсат: слой запотевания
 * над строкой гаснет прозрачностью за 0.5 секунды. Сам текст всегда лежит
 * в разметке — прячем высотой (grid-template-rows) и доступностью,
 * а не условным рендером: иначе ответов не будет в HTML.
 */
export function BlockFaq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="sec faq on-light" aria-label="Вопросы">
      <div className="wrap faq__grid">
        <header className="faq__aside">
          <p className="eyebrow">Короткие ответы</p>
          <h2 className="h2">Вопросы</h2>
          <p className="lead">
            Если чего-то нет в списке — позвоните, ответим сразу. Отвечает тот же человек,
            который встретит вас на входе.
          </p>
        </header>

        <div className="faq__list">
          {FAQ.map((f, i) => {
            const on = open === i
            return (
              <div className="faq__item" key={f.q}>
                <button
                  className="faq__q"
                  aria-expanded={on}
                  aria-controls={`faq-${i}`}
                  onClick={() => setOpen(on ? null : i)}
                >
                  <span>{f.q}</span>
                  <span className="faq__sign" aria-hidden="true" />
                </button>

                <div className="faq__wrap" id={`faq-${i}`} role="region" aria-hidden={!on}>
                  <div className="faq__inner">
                    <p className="faq__a">
                      <img className="faq__mist" src={A('/img/frost.webp')} alt="" aria-hidden="true" loading="lazy" decoding="async" />
                      <span>{f.a}</span>
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
