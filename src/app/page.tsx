import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { Fab } from '@/components/Fab'
import { SmoothScroll } from '@/components/SmoothScroll'
import { Scene } from '@/components/Scene'
import { SteamFlow } from '@/components/SteamFlow'
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
      {/* Полотно страницы: неподвижная стопка готовых состояний фона
          и мастер-таймлайн, который их перегоняет. */}
      <Scene />
      <Header />
      <main className="page">
        <Hero />
        {/* Поток проходит сквозь всю страницу и нигде не обрывается —
            это связующее вещество, а не украшение сцены героя. */}
        <div className="flow-page" aria-hidden="true">
          <SteamFlow />
        </div>
        <BlockComplex />
        <BlockVisit />
        <BlockPrices />
        <BlockReviews />
        <BlockFaq />
        <BlockRoute />
        <BlockBooking />

        <footer className="sec on-dark">
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
      </main>
      <Fab />
    </>
  )
}
