'use client'

import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { METRICS, DEFAULT_PAIR } from '@/lib/fonts'
import { BRAND } from '@/lib/content'
import { reduced } from '@/lib/motion'
import { bakeNoise3D } from '@/lib/steam/noise3d'
import { VERT, FLOW_FRAG, VOLUME_FRAG, BLEND_FRAG } from '@/lib/steam/shaders'

/** Срез нижней кромкой. Совпадает с CROP в fonts.ts. */
const CROP = 0.15
/** Половинное разрешение марша. */
const SCALE = 0.5
/** Хвост объёма ниже героя: там пар вытекает в следующий блок. */
const TAIL = 0.26
const FLOW_W = 320
const FLOW_H = 200
const FPS_FLOOR = 45

type Kill = () => void

/**
 * Объёмный пар героя.
 *
 * Трёхмерное шумовое поле, луч сквозь тело, рассеяние в сторону света.
 * Пар стелется пластами: шум растянут по горизонтали втрое, дрейф почти
 * незаметен, накопленная непрозрачность ограничена половиной — сквозь
 * пар обязана читаться фотография.
 *
 * Вордмарк живёт внутри объёма дважды: как изображение на своей глубине
 * и как препятствие для среды. Поле букв печётся в отдельную текстуру:
 * R — близость к литере, G — верхняя кромка, B — разрежение за буквой.
 *
 * Холст выходит ниже героя на TAIL: там объём вытягивается за границу
 * экрана и растворяется в фоне следующего блока, шва не остаётся.
 */
export function SteamVolume() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const box = host.current
    if (!box) return
    const hero = document.querySelector('.hero') as HTMLElement | null
    if (!hero) return

    const q = new URLSearchParams(window.location.search).get('steam')
    if (q === 'off') return
    if (q !== 'force') {
      if (reduced()) return
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
      if (window.innerWidth <= 860) return
    }

    let kill: Kill | null = null
    let dead = false
    const sp = new URLSearchParams(window.location.search)
    const stepsQ = Number(sp.get('steps'))
    // Ручной шаг: снимальщик сам двигает часы и курсор. Нужен потому, что
    // на программном рендерере кадр идёт секунду, и «+0.2 с» иначе не снять.
    const manual = q === 'force' && sp.get('manual') === '1'
    start(hero, box, q === 'force', stepsQ, manual).then((k) => {
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
  manual: boolean,
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
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
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
  hero.dataset.gl = '1'

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

  // ── Вордмарк и поле препятствия ────────────────────────────────────
  const wordCanvas = document.createElement('canvas')
  const wordCtx = wordCanvas.getContext('2d')!
  const wordTex = new THREE.CanvasTexture(wordCanvas)
  wordTex.minFilter = THREE.LinearFilter
  wordTex.magFilter = THREE.LinearFilter
  wordTex.generateMipmaps = false

  const fieldCanvas = document.createElement('canvas')
  const fieldCtx = fieldCanvas.getContext('2d')!
  const fieldTex = new THREE.CanvasTexture(fieldCanvas)
  fieldTex.minFilter = THREE.LinearFilter
  fieldTex.magFilter = THREE.LinearFilter
  fieldTex.generateMipmaps = false

  const m = METRICS[DEFAULT_PAIR.display]
  const family = m.family
  const weight = DEFAULT_PAIR.displayWeight
  const letters = BRAND.split('')
  const rise = letters.map(() => 1)

  let W = 0
  let heroH = 0
  let tailH = 0
  let canvasH = 0

  const layout = () => {
    const pad = Math.min(26, Math.max(10, W * 0.014))
    const sum = letters.reduce((a, c) => a + (m.adv[c] ?? 0.6), 0)
    const size = Math.min((0.22 * heroH) / m.capR, ((W - 2 * pad) / sum) * 0.94)
    const gap = (W - 2 * pad - sum * size) / (letters.length - 1)
    return { pad, size, gap, baseline: heroH + CROP * m.capR * size }
  }

  /** Рисует слово. Часть ниже кромки героя срезается — это и есть обрезка. */
  const drawWord = () => {
    if (!W || !canvasH) return
    if (wordCanvas.width !== W || wordCanvas.height !== canvasH) {
      wordCanvas.width = W
      wordCanvas.height = canvasH
    }
    const { pad, size, gap, baseline } = layout()
    wordCtx.clearRect(0, 0, W, canvasH)
    wordCtx.font = `${weight} ${size}px "${family}", Georgia, serif`
    wordCtx.fillStyle = '#f5f2eb'
    wordCtx.textBaseline = 'alphabetic'
    let x = pad
    letters.forEach((c, i) => {
      wordCtx.fillText(c, x, baseline + rise[i] * size * 1.08)
      x += (m.adv[c] ?? 0.6) * size + gap
    })
    // Ниже кромки экрана слова нет: хвост объёма букв не содержит.
    wordCtx.clearRect(0, heroH, W, canvasH - heroH)
    wordTex.needsUpdate = true
  }

  /**
   * Печёт поле препятствия. Считается один раз на раскладку, не в кадре:
   * размытие здесь — операция сборки, а не анимации.
   */
  const bakeField = () => {
    if (!W || !canvasH) return
    const fw = Math.max(2, Math.round(W / 2))
    const fh = Math.max(2, Math.round(canvasH / 2))
    fieldCanvas.width = fw
    fieldCanvas.height = fh

    const { pad, size, gap, baseline } = layout()
    const s = 0.5
    const mk = () => {
      const c = document.createElement('canvas')
      c.width = fw
      c.height = fh
      return c
    }
    const paint = (ctx: CanvasRenderingContext2D, dy: number) => {
      ctx.font = `${weight} ${size * s}px "${family}", Georgia, serif`
      ctx.fillStyle = '#fff'
      ctx.textBaseline = 'alphabetic'
      let x = pad * s
      letters.forEach((c) => {
        ctx.fillText(c, x, (baseline + dy) * s)
        x += ((m.adv[c] ?? 0.6) * size + gap) * s
      })
    }
    const blur = (ctx: CanvasRenderingContext2D, px: number) => {
      try {
        ctx.filter = `blur(${px}px)`
      } catch {
        /* фильтра нет — поле останется резче, но работать будет */
      }
    }

    // R — близость к литере: размытый силуэт.
    const cR = mk()
    const xR = cR.getContext('2d')!
    blur(xR, 16)
    paint(xR, 0)
    xR.filter = 'none'

    // G — верхняя кромка: силуэт минус он же, сдвинутый вниз.
    const cG = mk()
    const xG = cG.getContext('2d')!
    blur(xG, 3)
    paint(xG, 0)
    xG.filter = 'none'
    xG.globalCompositeOperation = 'destination-out'
    blur(xG, 3)
    paint(xG, size * 0.055)
    xG.filter = 'none'
    xG.globalCompositeOperation = 'source-over'

    // B — разрежение за буквой: силуэт, сдвинутый вниз и размытый,
    // из которого вычтена сама литера.
    const cB = mk()
    const xB = cB.getContext('2d')!
    blur(xB, 20)
    paint(xB, size * 0.10)
    xB.filter = 'none'
    xB.globalCompositeOperation = 'destination-out'
    paint(xB, 0)
    xB.globalCompositeOperation = 'source-over'

    // Ниже кромки героя букв нет — значит нет и препятствия. Без этого
    // в хвосте плотность растёт от литер, которых не видно.
    const cutY = Math.round(heroH * s)
    for (const c of [cR, cG, cB]) {
      const x = c.getContext('2d')!
      x.clearRect(0, cutY, fw, fh - cutY)
    }

    const get = (c: HTMLCanvasElement) => c.getContext('2d')!.getImageData(0, 0, fw, fh).data
    const [dR, dG, dB] = [get(cR), get(cG), get(cB)]
    const out = fieldCtx.createImageData(fw, fh)
    for (let i = 0; i < fw * fh; i++) {
      const j = i * 4
      out.data[j] = dR[j + 3]
      out.data[j + 1] = dG[j + 3]
      out.data[j + 2] = dB[j + 3]
      out.data[j + 3] = 255
    }
    fieldCtx.putImageData(out, 0, 0)
    fieldTex.needsUpdate = true
  }

  await (document.fonts?.load?.(`${weight} 100px "${family}"`) ?? Promise.resolve())

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
      uWordField: { value: fieldTex },
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
      uWordField: { value: fieldTex },
      uCam: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uFrame: { value: 0 },
      uSteps: { value: stepsQ >= 6 && stepsQ <= 48 ? stepsQ : 28 },
      uHeroFrac: { value: 1 },
      uTailFrac: { value: 0 },
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

  const mesh = new THREE.Mesh<import('three').BufferGeometry, import('three').Material>(
    quad,
    flowMat,
  )
  scene.add(mesh)

  const resize = () => {
    W = hero.clientWidth
    heroH = hero.clientHeight
    if (!W || !heroH) return
    tailH = Math.round(heroH * TAIL)
    canvasH = heroH + tailH
    box.style.height = `${canvasH}px`
    renderer.setSize(W, canvasH, false)
    const rw = Math.max(2, Math.round(W * SCALE))
    const rh = Math.max(2, Math.round(canvasH * SCALE))
    volRT.setSize(rw, rh)
    histA.setSize(rw, rh)
    histB.setSize(rw, rh)
    volMat.uniforms.uAspect.value = W / canvasH
    volMat.uniforms.uHeroFrac.value = heroH / canvasH
    volMat.uniforms.uTailFrac.value = tailH / canvasH
    flowMat.uniforms.uAspect.value = W / canvasH
    drawWord()
    bakeField()
  }
  resize()
  const onResize = () => resize()
  window.addEventListener('resize', onResize)

  // ── Курсор ─────────────────────────────────────────────────────────
  const p1 = new THREE.Vector2(0.5, 0.5)
  let active = 0
  let camX = 0
  let camY = 0
  let camTX = 0
  let camTY = 0

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const r = hero.getBoundingClientRect()
    p1.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / canvasH)
    active = 1
    const nx = (e.clientX / window.innerWidth - 0.5) * 2
    const ny = (e.clientY / window.innerHeight - 0.5) * 2
    camTX = -nx * (12 / Math.max(canvasH, 1)) * 2.2
    camTY = ny * (12 / Math.max(canvasH, 1)) * 2.2
  }
  const onLeave = () => {
    active = 0
    camTX = 0
    camTY = 0
  }
  hero.addEventListener('pointermove', onMove, { passive: true })
  hero.addEventListener('pointerleave', onLeave)

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

  // ── Герой ушёл из кадра — считать нечего ───────────────────────────
  let onScreen = true
  const io = new IntersectionObserver(
    ([e]) => {
      const was = onScreen
      onScreen = e.isIntersecting
      if (onScreen && !was && !stopped) {
        last = performance.now()
        raf = requestAnimationFrame(render)
      }
    },
    { threshold: 0 },
  )
  io.observe(hero)

  // ── Цикл ───────────────────────────────────────────────────────────
  let frame = 0
  let last = performance.now()
  let raf = 0
  const samples: number[] = []
  let watchdogDone = false
  let stopped = false
  const startedAt = performance.now()

  function render(now: number) {
    if (stopped) return
    if (!onScreen) {
      raf = 0
      return
    }
    if (!manual) raf = requestAnimationFrame(render)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (!W || !canvasH) return
    if (!watchdogDone && dt > 0) samples.push(1 / dt)

    flowMat.uniforms.uPrev.value = flowA.texture
    flowMat.uniforms.uP1.value.copy(p1)
    flowMat.uniforms.uDt.value = dt
    flowMat.uniforms.uActive.value = active
    mesh.material = flowMat
    renderer.setRenderTarget(flowB)
    renderer.render(scene, cam)
    ;[flowA, flowB] = [flowB, flowA]

    camX += (camTX - camX) * 0.06
    camY += (camTY - camY) * 0.06
    volMat.uniforms.uFlow.value = flowA.texture
    volMat.uniforms.uTime.value = now * 0.001
    volMat.uniforms.uFrame.value = frame
    volMat.uniforms.uCam.value.set(camX, camY)
    mesh.material = volMat
    renderer.setRenderTarget(volRT)
    renderer.render(scene, cam)

    blendMat.uniforms.uCur.value = volRT.texture
    blendMat.uniforms.uPrev.value = histA.texture
    blendMat.uniforms.uMix.value = frame < 3 ? 0 : 0.7
    mesh.material = blendMat
    renderer.setRenderTarget(histB)
    renderer.render(scene, cam)
    ;[histA, histB] = [histB, histA]

    outMat.map = histA.texture
    mesh.material = outMat
    renderer.setRenderTarget(null)
    renderer.render(scene, cam)
    frame++

    if (!watchdogDone && now - startedAt > 2000) {
      watchdogDone = true
      // Первые кадры прогревочные и их отбрасываем — но только если
      // кадров вообще набралось. Машина, не осилившая шесть кадров за
      // две секунды, обязана получить откат, а не оценку «60».
      const s = (samples.length > 10 ? samples.slice(5) : samples).sort((a, b) => a - b)
      const med = s.length ? s[Math.floor(s.length / 2)] : 0
      ;(window as unknown as { __steamFps?: number }).__steamFps = med
      if (med < FPS_FLOOR && !force) {
        // eslint-disable-next-line no-console
        console.info(`[пар] медиана ${med.toFixed(1)} fps < ${FPS_FLOOR} — объём выключен`)
        fallback()
      }
    }
  }

  if (manual) {
    // Виртуальные часы: шаг в 1/60 с независимо от того, сколько
    // реального времени железо потратило на кадр.
    watchdogDone = true
    intro.progress(1)
    fadeIn.progress(1)
    let vnow = performance.now()
    ;(window as unknown as { __steam?: unknown }).__steam = {
      /**
       * Прокрутить секунды модели. Затухание считается от dt, поэтому
       * крупный шаг годится для «отстояться», мелкий — для фаз реакции.
       */
      run(seconds: number, hz = 60) {
        const step = 1000 / hz
        const n = Math.max(1, Math.round(seconds * hz))
        for (let i = 0; i < n; i++) {
          vnow += step
          last = vnow - step
          render(vnow)
        }
      },
      /** Поставить курсор в точку экрана (координаты страницы). */
      point(cx: number, cy: number) {
        const r = hero.getBoundingClientRect()
        p1.set((cx - r.left) / r.width, 1 - (cy - r.top) / canvasH)
        active = 1
      },
      leave() {
        active = 0
      },
    }
  } else {
    raf = requestAnimationFrame(render)
  }

  const dispose = () => {
    stopped = true
    if (raf) cancelAnimationFrame(raf)
    io.disconnect()
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
    fieldTex.dispose()
    renderer.dispose()
    canvas.remove()
  }

  function fallback() {
    delete hero.dataset.gl
    dispose()
  }

  return dispose
}
