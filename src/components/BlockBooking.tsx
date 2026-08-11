'use client'

import { useRef, useState } from 'react'
import { A } from '@/lib/asset'
import { GUESTS, PHONE, PHONE_HREF, TARIFFS } from '@/lib/content'

type Miss = Record<string, boolean>

/**
 * Блок 7 — Запись. Форма на запотевшем стекле: поля — прочищенные
 * дорожки в конденсате.
 *
 * Сервера нет, выдача статическая. Форма честно об этом не врёт:
 * подтверждение показывается сразу, а телефон рядом остаётся рабочим.
 * Валидация мягкая — пустое поле подсвечивается, красных крестов нет.
 */
export function BlockBooking() {
  const [sent, setSent] = useState(false)
  const [miss, setMiss] = useState<Miss>({})
  const form = useRef<HTMLFormElement>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData(form.current!)
    const need = ['name', 'phone', 'date']
    const bad: Miss = {}
    need.forEach((k) => {
      if (!String(fd.get(k) ?? '').trim()) bad[k] = true
    })
    setMiss(bad)
    if (Object.keys(bad).length) {
      form.current!.querySelector<HTMLElement>('[data-miss="1"] .fld__in')?.focus()
      return
    }
    setSent(true)
  }

  return (
    <section className="sec book on-dark" id="zapis">
      <img className="book__mist" src={A('/img/fog.webp')} alt="" aria-hidden="true" loading="lazy" decoding="async" />

      <div className="wrap">
        <header className="sec__head" style={{ borderBottom: 0 }}>
          <h2 className="h2">Запись</h2>
          <p className="eyebrow">Перезвоним и подтвердим</p>
        </header>

        <div className="book__glass">
          {sent ? (
            <div className="book__done" role="status">
              <b>Заявка принята</b>
              <p className="lead" style={{ margin: '0 auto' }}>
                Перезвоним в течение 15 минут
              </p>
            </div>
          ) : (
            <form className="book__form" ref={form} onSubmit={submit} noValidate>
              <div className="fld" data-miss={miss.name ? '1' : '0'}>
                <label className="fld__lab" htmlFor="f-name">
                  Имя
                </label>
                <input className="fld__in" id="f-name" name="name" placeholder="Как к вам обращаться" />
              </div>

              <div className="fld" data-miss={miss.phone ? '1' : '0'}>
                <label className="fld__lab" htmlFor="f-phone">
                  Телефон
                </label>
                <input
                  className="fld__in"
                  id="f-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="+7"
                />
              </div>

              <div className="fld fld--sm" data-miss={miss.date ? '1' : '0'}>
                <label className="fld__lab" htmlFor="f-date">
                  Дата
                </label>
                <input
                  className="fld__in"
                  id="f-date"
                  name="date"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="дд.мм.гггг"
                />
              </div>

              <div className="fld fld--sm">
                <label className="fld__lab" htmlFor="f-guests">
                  Человек
                </label>
                <select className="fld__in" id="f-guests" name="guests" defaultValue="2">
                  {GUESTS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="fld fld--sm">
                <label className="fld__lab" htmlFor="f-tariff">
                  Тариф
                </label>
                <select className="fld__in" id="f-tariff" name="tariff" defaultValue="4h">
                  {TARIFFS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.price} ₽
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="fld--full"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 'clamp(12px,1.6vw,24px)',
                  marginTop: 'clamp(6px,1vh,14px)',
                }}
              >
                <button className="btn" type="submit">
                  <span>Записаться</span>
                </button>
                <p style={{ margin: 0, color: 'var(--fg-mute)', fontSize: 'var(--t-cap)', letterSpacing: '.1em' }}>
                  Или позвоните: <a href={PHONE_HREF}>{PHONE}</a>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
