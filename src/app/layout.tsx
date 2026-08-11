import type { Metadata, Viewport } from 'next'
import './globals.css'
import { FontFaces } from '@/components/FontFaces'
import { A } from '@/lib/asset'
import { DEFAULT_PAIR } from '@/lib/fonts'
import { pairVars } from '@/lib/pairStyle'
import { HOURS } from '@/lib/content'

export const metadata: Metadata = {
  title: 'TERMA — термальный комплекс в горах, 1800 м',
  description: `Инфинити-бассейн над долиной, русская парная, хамам и купель на высоте 1800 метров. Открыто ${HOURS}.`,
  openGraph: {
    title: 'TERMA — горячая вода на высоте 1800',
    description: 'Термальный комплекс в горах. Инфинити-бассейн, парная, хамам, купель.',
    type: 'website',
    locale: 'ru_RU',
  },
}

export const viewport: Viewport = {
  themeColor: '#221e19',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="no-js" style={pairVars(DEFAULT_PAIR)}>
      <head>
        {/* Стартовые позиции входа живут в CSS под .no-js — снимаем метку
            до первой отрисовки, иначе кадр мигнёт готовой композицией. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.remove('no-js')",
          }}
        />
        <FontFaces />
        {/* Вордмарк — часть LCP-кадра, его файл тянем первым. */}
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href={A(`/fonts/${DEFAULT_PAIR.display}.woff2`)}
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href={A(`/fonts/${DEFAULT_PAIR.text}.woff2`)}
          crossOrigin="anonymous"
        />
        {/* Кадр героя — это LCP. Браузер должен узнать о нём из <head>,
            а не после разбора компонента. */}
        <link
          rel="preload"
          as="image"
          type="image/avif"
          href={A('/img/hero-mobile-800.avif')}
          media="(max-width: 860px)"
          imageSrcSet={`${A('/img/hero-mobile-800.avif')} 800w, ${A('/img/hero-mobile-1200.avif')} 1200w`}
          imageSizes="100vw"
          fetchPriority="high"
        />
        <link
          rel="preload"
          as="image"
          type="image/avif"
          href={A('/img/hero-desktop-1600.avif')}
          media="(min-width: 861px)"
          imageSrcSet={`${A('/img/hero-desktop-1600.avif')} 1600w, ${A('/img/hero-desktop-2400.avif')} 2400w`}
          imageSizes="100vw"
          fetchPriority="high"
        />
        <link rel="icon" href={A('/favicon.svg')} type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  )
}
