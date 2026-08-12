import { A } from '@/lib/asset'
import { BRAND, HOURS, NAV } from '@/lib/content'
import { METRICS, type Pair } from '@/lib/fonts'
import { pairVars } from '@/lib/pairStyle'

/**
 * Статичный кадр героя для витрины /fonts.
 *
 * Ровно та же композиция и те же кегли, что в бою, но без единой
 * анимации: арт-директор сравнивает кадрами, а проверка звучит так —
 * «убрать движение, снять скриншот, кадр должен держаться сам».
 */
export function HeroStill({ pair }: { pair: Pair }) {
  const d = METRICS[pair.display]
  const t = METRICS[pair.text]

  return (
    <div className="hero still" style={pairVars(pair)}>
      <div className="hero__bg">
        <picture>
          <source type="image/avif" srcSet={A('/img/hero-desktop-2400.avif')} />
          <img src={A('/img/hero-desktop-1600.webp')} alt="" width={2752} height={1536} />
        </picture>
        <div className="hero__scrim" />
      </div>

      <div className="wm" aria-hidden="true">
        {BRAND.split('').map((c, i) => (
          <i key={i} style={{ display: 'block', fontStyle: 'normal' }}>
            <span>{c}</span>
          </i>
        ))}
      </div>

      <div className="steam" aria-hidden="true">
        <img className="steam__l" src={A('/img/steam-1.webp')} alt="" />
        <img className="steam__l" src={A('/img/steam-2.webp')} alt="" />
        <img className="steam__l" src={A('/img/steam-3.webp')} alt="" />
      </div>

      <header className="hdr" style={{ position: 'absolute' }}>
        <div className="hdr__in">
          <span className="hdr__mark">{BRAND}</span>
          <nav className="hdr__nav">
            {NAV.map((n) => (
              <span className="hdr__link" key={n.id}>
                {n.label}
              </span>
            ))}
          </nav>
        </div>
      </header>

      <div className="hero__copy">
        <div className="hero__grid">
          <h1>
            <span className="ln">
              <span>Горячая вода</span>
            </span>
            <span className="ln">
              <span>на высоте 1800</span>
            </span>
          </h1>
          <p className="hero__lead">Термальный комплекс в горах. Открыто {HOURS}.</p>
          <div className="hero__acts">
            <span className="btn">
              <span>Записаться</span>
            </span>
            <span className="btn btn--ghost">
              <span>Смотреть цены</span>
            </span>
          </div>
        </div>
      </div>

      <p className="still__tag">
        {d.family} · {t.family} — литера {Math.round(d.capR * 100)}% em, файлы{' '}
        {Math.round((d.bytes + t.bytes) / 1024)} КБ
      </p>
    </div>
  )
}
