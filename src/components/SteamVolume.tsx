'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { METRICS } from '@/lib/fonts'
import { BRAND } from '@/lib/content'
import { reduced } from '@/lib/motion'
import { bakeNoise3D } from '@/lib/steam/noise3d'
import { VERT, FLOW_FRAG, VOLUME_FRAG, BLEND_FRAG } from '@/lib/steam/shaders'

/** Доля высоты литеры, срезаемая нижней кромкой. Совпадает с CROP в fonts.ts. */
const CROP = 0.34
/** Половинное разрешение марша: на паре не видно, а стоит вчетверо дешевле. */
const SCALE = 0.5
const FLOW_W = 320
const FLOW_H = 180

/** Порог живучести: медиана fps за первые две секунды. */
const FPS_FLOOR = 45

type Kill = () => void

/**
 * Объёмный пар героя.
 *
 * Не текстура на плоскости: трёхмерное шумовое поле, луч из камеры идёт
 * сквозь тело и набирает плотность, свет считается в сторону источника.
 * Плоскость вордмарка стоит внутри объёма, поэтому клубы проходят и
 * перед буквами, и за ними — это следует из геометрии марша, а не из
 * подобранной непрозрачности двух слоёв.
 *
 * Курсор толкает среду через поле скоростей с адвекцией: пар уходит
 * вперёд по вектору движения, позади остаётся коридор, по бокам следа
 * закручиваются два встречных вихря.
 */
export function SteamVolume() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const box = host.current
    if (!box) return
    const hero = box.closest('.hero') as HTMLElement | null
    if (!hero) return

    // Диагностические ключи: ?steam=force держит объём включённым при
    // любом fps (нужно для съёмки и для проверки на слабой машине),
    // ?steam=off гасит его совсем.
    const q = new URLSearchParams(window.location.search).get('steam')
    if (q === 'off') return

    // Мобильная и уважение к настройке ОС: объёмного пара нет,
    // остаётся испечённый — он никуда не делся и лежит слоем ниже.
    if (q !== 'force') {
      if (reduced()) return
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
      if (window.innerWidth <= 860) return
    }

    let kill: Kill | null = null
    let dead = false

    const stepsQ = Number(new URLSearchParams(window.location.search).get('steps'))
    start(hero, box, q === 'force', stepsQ).then((k) => {
      if (dead) k?.()
      else kill = k
    })

    return () => {
      dead = true
      kill?.()
    }
  }, [])

  return <div className="steamgl" ref={host} aria-hidden="true" />
}

async function start(
  hero: HTMLElement,
  box: HTMLElement,
  force: boolean,
  stepsQ: number,
): Promise<Kill | null> {
  let THREE: typeof import('three')
  try {
    THREE = await import('three')
  } catch {
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.className = 'steamgl__c'
  let renderer: import('three').WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    })
    // Без WebGL2 нет sampler3D — значит нет и объёма. Уходим на испечённый.
    if (!renderer.capabilities.isWebGL2) {
      renderer.dispose()
      return null
    }
  } catch {
    return null
  }

  renderer.setPixelRatio(1)
  renderer.setClearColor(0x000000, 0)
  box.appendChild(canvas)
  // Ставим метку до печати поля: испечённые полосы гаснут сразу,
  // иначе они успевают проявиться и мигнуть при передаче объёму.
  hero.dataset.gl = '1'

  // ── Трёхмерное шумовое поле ────────────────────────────────────────
  const baked = bakeNoise3D()
  const noiseTex = new THREE.Data3DTexture(baked.data, baked.size, baked.size, baked.size)
  noiseTex.format = THREE.RGBAFormat
  noiseTex.type = THREE.UnsignedByteType
  noiseTex.minFilter = THREE.LinearFilter
  noiseTex.magFilter = THREE.LinearFilter
  noiseTex.wrapS = THREE.RepeatWrapping
  noiseTex.wrapT = THREE.RepeatWrapping
  noiseTex.wrapR = THREE.RepeatWrapping
  noiseTex.unpackAlignment = 1
  noiseTex.needsUpdate = true

  // ── Вордмарк: рисуем сами, ровно по той же геометрии, что и в CSS ──
  const wordCanvas = document.createElement('canvas')
  const wordCtx = wordCanvas.getContext('2d')!
  const wordTex = new THREE.CanvasTexture(wordCanvas)
  wordTex.minFilter = THREE.LinearFilter
  wordTex.magFilter = THREE.LinearFilter
  wordTex.generateMipmaps = false

  const m = METRICS.golos
  const letters = BRAND.split('')
  const rise = letters.map(() => 1)

  const drawWord = () => {
    const w = hero.clientWidth
    const h = hero.clientHeight
    if (wordCanvas.width !== w || wordCanvas.height !== h) {
      wordCanvas.width = w
      wordCanvas.height = h
    }
    wordCtx.clearRect(0, 0, w, h)

    const pad = Math.min(26, Math.max(10, w * 0.014))
    const sum = letters.reduce((a, c) => a + (m.adv[c] ?? 0.6), 0)
    const size = Math.min((0.22 * h) / m.capR, ((w - 2 * pad) / sum) * 0.94)
    const baseline = h + CROP * m.capR * size

    wordCtx.font = `900 ${size}px "Golos Text", system-ui, sans-serif`
    wordCtx.fillStyle = '#f5f2eb'
    wordCtx.textBaseline = 'alphabetic'

    const totalAdv = sum * size
    const gap = (w - 2 * pad - totalAdv) / (letters.length - 1)
    let x = pad
    letters.forEach((c, i) => {
      wordCtx.fillText(c, x, baseline + rise[i] * size * 1.08)
      x += (m.adv[c] ?? 0.6) * size + gap
    })
    wordTex.needsUpdate = true
  }

  await (document.fonts?.load?.('900 100px "Golos Text"') ?? Promise.resolve())
  drawWord()

  // ── Сцена ──────────────────────────────────────────────────────────
  const scene = new THREE.Scene()
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const quad = new THREE.PlaneGeometry(2, 2)

  const rtOpts = {
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: THREE.HalfFloatType,
  } as const

  let flowA = new THREE.WebGLRenderTarget(FLOW_W, FLOW_H, rtOpts)
  let flowB = new THREE.WebGLRenderTarget(FLOW_W, FLOW_H, rtOpts)
  let volRT = new THREE.WebGLRenderTarget(2, 2, rtOpts)
  let histA = new THREE.WebGLRenderTarget(2, 2, rtOpts)
  let histB = new THREE.WebGLRenderTarget(2, 2, rtOpts)

  const flowMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    blending: THREE.NoBlending,
    vertexShader: VERT,
    fragmentShader: FLOW_FRAG,
    uniforms: {
      uPrev: { value: flowA.texture },
      uP0: { value: new THREE.Vector2(0.5, 0.5) },
      uP1: { value: new THREE.Vector2(0.5, 0.5) },
      uDt: { value: 0.016 },
      uActive: { value: 0 },
      uAspect: { value: 1 },
    },
  })

  const volMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    blending: THREE.NoBlending,
    vertexShader: VERT,
    fragmentShader: VOLUME_FRAG,
    uniforms: {
      uNoise: { value: noiseTex },
      uFlow: { value: flowA.texture },
      uWord: { value: wordTex },
      uCam: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uFrame: { value: 0 },
      uSteps: { value: stepsQ >= 6 && stepsQ <= 48 ? stepsQ : 28 },
      uReveal: { value: 1 },
    },
  })

  const blendMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    blending: THREE.NoBlending,
    vertexShader: VERT,
    fragmentShader: BLEND_FRAG,
    uniforms: {
      uCur: { value: null as unknown as import('three').Texture },
      uPrev: { value: null as unknown as import('three').Texture },
      uMix: { value: 0.72 },
    },
  })

  const outMat = new THREE.MeshBasicMaterial({
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
  })

  const mesh = new THREE.Mesh<import("three").BufferGeometry, import("three").Material>(
    quad,
    flowMat,
  )
  scene.add(mesh)

  // ── Размеры ────────────────────────────────────────────────────────
  let W = 0
  let H = 0
  const resize = () => {
    W = hero.clientWidth
    H = hero.clientHeight
    if (!W || !H) return
    renderer.setSize(W, H, false)
    const rw = Math.max(2, Math.round(W * SCALE))
    const rh = Math.max(2, Math.round(H * SCALE))
    volRT.setSize(rw, rh)
    histA.setSize(rw, rh)
    histB.setSize(rw, rh)
    volMat.uniforms.uAspect.value = W / H
    flowMat.uniforms.uAspect.value = W / H
    drawWord()
  }
  resize()
  const onResize = () => resize()
  window.addEventListener('resize', onResize)

  // ── Курсор ─────────────────────────────────────────────────────────
  const p0 = new THREE.Vector2(0.5, 0.5)
  const p1 = new THREE.Vector2(0.5, 0.5)
  let active = 0
  let camX = 0
  let camY = 0
  let camTX = 0
  let camTY = 0

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const r = hero.getBoundingClientRect()
    p1.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height)
    active = 1
    // Параллакс камеры до 12 px — теперь он даёт настоящее расслоение.
    const nx = (e.clientX / window.innerWidth - 0.5) * 2
    const ny = (e.clientY / window.innerHeight - 0.5) * 2
    camTX = -nx * (12 / Math.max(H, 1)) * 2.2
    camTY = ny * (12 / Math.max(H, 1)) * 2.2
  }
  const onLeave = () => {
    active = 0
    camTX = 0
    camTY = 0
  }
  hero.addEventListener('pointermove', onMove, { passive: true })
  hero.addEventListener('pointerleave', onLeave)

  // ── Вход: слово выезжает снизу, как и в разметочной версии ─────────
  const intro = gsap.to(rise, {
    ...Object.fromEntries(letters.map((_, i) => [i, 0])),
    duration: 1.5,
    ease: 'expo.out',
    stagger: 0.05,
    delay: 0.25,
    onUpdate: drawWord,
  })

  gsap.set(canvas, { opacity: 0 })
  const fadeIn = gsap.to(canvas, { opacity: 1, duration: 1.4, delay: 0.55, ease: 'power2.out' })

  // ── Цикл ───────────────────────────────────────────────────────────
  let frame = 0
  let last = performance.now()
  let raf = 0
  const samples: number[] = []
  let watchdogDone = false
  let stopped = false

  const render = (now: number) => {
    if (stopped) return
    raf = requestAnimationFrame(render)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (!W || !H) return

    if (!watchdogDone && dt > 0) samples.push(1 / dt)

    // Скорость нужна до сдвига p0 — иначе она всегда ноль.
    const sp = p1.distanceTo(p0)

    // 1. Поле скоростей.
    flowMat.uniforms.uPrev.value = flowA.texture
    flowMat.uniforms.uP0.value.copy(p0)
    flowMat.uniforms.uP1.value.copy(p1)
    flowMat.uniforms.uDt.value = dt
    flowMat.uniforms.uActive.value = active
    mesh.material = flowMat
    renderer.setRenderTarget(flowB)
    renderer.render(scene, cam)
    ;[flowA, flowB] = [flowB, flowA]
    p0.copy(p1)

    // 2. Марш по объёму в половинном разрешении.
    camX += (camTX - camX) * 0.06
    camY += (camTY - camY) * 0.06
    volMat.uniforms.uFlow.value = flowA.texture
    volMat.uniforms.uTime.value = now * 0.001
    volMat.uniforms.uFrame.value = frame
    volMat.uniforms.uCam.value.set(camX, camY)
    mesh.material = volMat
    renderer.setRenderTarget(volRT)
    renderer.render(scene, cam)

    // 3. Смешение с прошлым кадром — гасит дизеринг марша.
    //    Когда курсор быстро едет, вес прошлого падает, иначе след смажет.
    blendMat.uniforms.uCur.value = volRT.texture
    blendMat.uniforms.uPrev.value = histA.texture
    blendMat.uniforms.uMix.value = frame < 3 ? 0 : Math.max(0.2, 0.72 - sp * 40)
    mesh.material = blendMat
    renderer.setRenderTarget(histB)
    renderer.render(scene, cam)
    ;[histA, histB] = [histB, histA]

    // 4. На экран.
    outMat.map = histA.texture
    mesh.material = outMat
    renderer.setRenderTarget(null)
    renderer.render(scene, cam)

    frame++

    // Сторож: решение принимается по фактическому fps, не по юзер-агенту.
    if (!watchdogDone && now - startedAt > 2000) {
      watchdogDone = true
      const s = samples.slice(5).sort((a, b) => a - b)
      const med = s.length ? s[Math.floor(s.length / 2)] : 60
      ;(window as unknown as { __steamFps?: number }).__steamFps = med
      if (med < FPS_FLOOR && !force) {
        // eslint-disable-next-line no-console
        console.info(`[пар] медиана ${med.toFixed(1)} fps < ${FPS_FLOOR} — объём выключен`)
        fallback()
      }
    }
  }

  const startedAt = performance.now()
  raf = requestAnimationFrame(render)

  const dispose = () => {
    stopped = true
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
    hero.removeEventListener('pointermove', onMove)
    hero.removeEventListener('pointerleave', onLeave)
    intro.kill()
    fadeIn.kill()
    flowA.dispose()
    flowB.dispose()
    volRT.dispose()
    histA.dispose()
    histB.dispose()
    flowMat.dispose()
    volMat.dispose()
    blendMat.dispose()
    outMat.dispose()
    quad.dispose()
    noiseTex.dispose()
    wordTex.dispose()
    renderer.dispose()
    canvas.remove()
  }

  function fallback() {
    delete hero.dataset.gl
    dispose()
  }

  return dispose
}
