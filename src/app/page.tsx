import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { Fab } from '@/components/Fab'
import { SmoothScroll } from '@/components/SmoothScroll'
import { SteamVolume } from '@/components/SteamVolume'
import { BlockComplex } from '@/components/BlockComplex'
import { BlockVisit } from '@/components/BlockVisit'
import { BlockPrices } from '@/components/BlockPrices'
import { BlockReviews } from '@/components/BlockReviews'
import { BlockFaq } from '@/components/BlockFaq'
import { BlockRoute } from '@/components/BlockRoute'
import { BlockBooking } from '@/components/BlockBooking'
import { BRAND, HOURS, PHONE, PHONE_HREF, ROUTE } from '@/lib/content'

export default function Page() {
  return (
    <>
      <SmoothScroll />
      <Header />
      <main className="page">
        <Hero />
        {/* Объём выходит ниже героя и растворяется в следующем блоке,
            поэтому холст живёт рядом с героем, а не внутри его обрезки. */}
        <SteamVolume />
        <BlockComplex />
        <BlockVisit />
        <BlockPrices />
        <BlockReviews />
        <BlockFaq />
        <BlockRoute />
        <BlockBooking />
      </main>
      <Fab />

      <footer className="sec on-dark" style={{ background: 'var(--ink)' }}>
        <div className="wrap">
          <div className="foot">
            <span>
              {BRAND} · {ROUTE.address}
            </span>
            <span>Ежедневно {HOURS}</span>
            <a href={PHONE_HREF}>{PHONE}</a>
          </div>
        </div>
      </footer>
    </>
  )
}
