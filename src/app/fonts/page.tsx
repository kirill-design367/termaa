import type { Metadata } from 'next'
import { HeroStill } from '@/components/HeroStill'
import { METRICS, PAIRS } from '@/lib/fonts'
import { pairVars } from '@/lib/pairStyle'

export const metadata: Metadata = {
  title: 'TERMA — три пары шрифтов',
  description: 'Витрина: полная композиция героя каждой парой, финальные кегли, реальный фон.',
  robots: { index: false, follow: false },
}

const ALPHA = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'

export default function FontsPage() {
  return (
    <main className="specimens on-light">
      <div className="wrap">
        <header className="sec__head" style={{ paddingBottom: 'clamp(20px,3vh,36px)' }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: '1.2em' }}>
              Витрина · сравнение кадрами
            </p>
            <h1 className="h2">Три пары</h1>
          </div>
          <p className="lead" style={{ maxWidth: '46ch' }}>
            У каждой пары — полная композиция героя в финальных кеглях, на реальном фоне
            и без анимации. Сейчас в бою стоит первая: {PAIRS[0].title}.
          </p>
        </header>
      </div>

      {PAIRS.map((p, i) => {
        const d = METRICS[p.display]
        const t = METRICS[p.text]
        return (
          <article className="spec" key={p.id} style={pairVars(p)}>
            <div className="wrap">
              <div className="spec__head">
                <p className="eyebrow">
                  Пара {i + 1}
                  {i === 0 ? ' · сейчас в бою' : ''}
                </p>
                <h2 className="h2" style={{ marginBlock: '0.3em 0.4em' }}>
                  {p.title}
                </h2>
                <dl className="spec__facts">
                  <div>
                    <dt>Производитель</dt>
                    <dd>{p.foundry}</dd>
                  </div>
                  <div>
                    <dt>Авторы</dt>
                    <dd>{p.designer}</dd>
                  </div>
                  <div>
                    <dt>Цена</dt>
                    <dd>{p.price}</dd>
                  </div>
                  <div>
                    <dt>Лицензия</dt>
                    <dd>{p.licence}</dd>
                  </div>
                  <div>
                    <dt>Ссылка</dt>
                    <dd>
                      <a href={p.link} rel="noreferrer noopener" target="_blank">
                        {p.link.replace('https://', '')}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>Кириллица</dt>
                    <dd>{p.cyr}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Полная композиция героя этой парой. */}
            <HeroStill pair={p} />

            <div className="wrap">
              <div className="spec__body">
                <p className="spec__why">{p.rationale}</p>

                <div className="spec__type">
                  <p className="eyebrow">Акцидентный · {d.family}</p>
                  <p className="spec__alpha" style={{ fontFamily: 'var(--font-display)' }}>
                    {ALPHA}
                  </p>
                  <p className="spec__big" style={{ fontFamily: 'var(--font-display)' }}>
                    Горячая вода
                  </p>

                  <p className="eyebrow" style={{ marginTop: '2.4em' }}>
                    Текстовый · {t.family}
                  </p>
                  <p className="spec__alpha" style={{ fontFamily: 'var(--font-text)' }}>
                    {ALPHA}
                  </p>
                  <div className="spec__sizes">
                    <p style={{ fontSize: 11, letterSpacing: '0.16em' }}>
                      11 px · трекинг 0.16 em · инфинити-бассейн, русская парная, хамам, купель
                    </p>
                    <p style={{ fontSize: 13, letterSpacing: '0.12em' }}>
                      13 px · трекинг 0.12 em · открыто с 8:00 до 23:00, без выходных
                    </p>
                    <p style={{ fontSize: 17 }}>
                      17 px · Дровяная печь топится с шести утра, камень набирает жар к открытию.
                    </p>
                  </div>

                  <p className="spec__metrics">
                    capHeight {d.capR} em · ascender {d.ascR} · descender {d.descR} · ширина
                    Т-Е-Р-М-А {Object.values(d.adv).reduce((a, b) => a + b, 0).toFixed(3)} em ·
                    сабсет {Math.round(d.bytes / 1024)} КБ + {Math.round(t.bytes / 1024)} КБ
                  </p>
                </div>
              </div>
            </div>
          </article>
        )
      })}

      <div className="wrap">
        <p className="spec__note">
          Все три пары отрисованы настоящими файлами из public/fonts, а не описаны словами.
          Лицензии позволяют коммерческое использование без выплат. Платные альтернативы,
          если решите вкладываться в эксклюзив, собраны в CLAUDE.md — раздел «Типографика».
        </p>
      </div>
    </main>
  )
}
