import { A } from '@/lib/asset'
import { FG_MASK } from '@/lib/hero'
import { BRAND, HERO_TAG, HERO_TITLE, HOURS_LINE, NAV } from '@/lib/content'
import { METRICS, type Pair } from '@/lib/fonts'
import { pairVars } from '@/lib/pairStyle'

/**
 * Статичный кадр героя для витрины /fonts.
 *
 * Ровно та же композиция и те же кегли, что в бою, но без единой
 * анимации и без воды: арт-директор сравнивает кадрами, а проверка
 * звучит так — «убрать движение, снять скриншот, кадр должен держаться
 * сам». Кегль заголовка здесь берётся формулой от числа знаков, а не
 * замером: в бою его ставит JS, а витрина обязана рисоваться сервером.
 */
export function HeroStill({ pair }: { pair: Pair }) {
  const d = METRICS[pair.display]
  const t = METRICS[pair.text]

  return (
    <div className="hero still" style={pairVars(pair)}>
      <div className="hero__stage">
        <div className="hero__bg">
          <picture>
            <source type="image/avif" srcSet={A('/img/hero-desktop-2400.avif')} />
            <img src={A('/img/hero-desktop-1600.webp')} alt="" width={2752} height={1536} />
          </picture>
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

        {/* Имя. Главный объект кадра — ради него витрина и существует. */}
        <p className="wm" aria-hidden="true">
          {BRAND.split('').map((c, i) => (
            <i key={i}>
              <span>{c}</span>
            </i>
          ))}
        </p>

        {/* Передний план: та же фотография под маской крыши и стоек.
            Без него витрина показывала бы не ту композицию, что в бою. */}
        <div
          className="hero__fg"
          aria-hidden="true"
          style={{
            WebkitMaskImage: `url(${A(FG_MASK)})`,
            maskImage: `url(${A(FG_MASK)})`,
          }}
        >
          <picture>
            <source type="image/avif" srcSet={A('/img/hero-desktop-2400.avif')} />
            <img src={A('/img/hero-desktop-1600.webp')} alt="" width={2752} height={1536} />
          </picture>
        </div>

        <h1 className="hero__title">
          {HERO_TITLE.map((line) => (
            <span className="ln" key={line}>
              {line}
            </span>
          ))}
        </h1>

        <span className="btn btn--hero hero__cta">Записаться</span>
        <span className="hero__edge hero__edge--l">{HOURS_LINE}</span>
        <span className="hero__edge hero__edge--r">{HERO_TAG}</span>
      </div>

      <p className="still__tag">
        {d.family} · {t.family} — литера {Math.round(d.capR * 100)}% em, файлы{' '}
        {Math.round((d.bytes + t.bytes) / 1024)} КБ
      </p>
    </div>
  )
}
