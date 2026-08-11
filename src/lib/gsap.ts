'use client'

import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLayoutEffect, useEffect } from 'react'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

export { gsap, ScrollTrigger }

/** На сервере layout-эффектов нет — не шумим в консоль. */
export const useIso = typeof window !== 'undefined' ? useLayoutEffect : useEffect
