'use client'

import { useEffect, useRef } from 'react'
import { METRICS, DEFAULT_PAIR } from '@/lib/fonts'
import { BRAND } from '@/lib/content'
import { reduced } from '@/lib/motion'
import { heroProgress } from '@/lib/scene'
import { bakeNoise3D } from '@/lib/steam/noise3d'
import { VERT, FLOW_FRAG, VOLUME_FRAG, BLEND_FRAG } from '@/lib/steam/shaders'

/** Срез нижней кромкой. Совпадает с CROP в fonts.ts. */
const CROP = 0.08
/** Половинное разрешение марша. */
const SCALE = 0.5
const FLOW_W = 320
const FLOW_H = 200
const FPS_FLOOR = 45

type Kill = () => void

/**
 * Восходящий поток пара в сцене героя.
 *
 * Пар рождается из полосы под нижней кромкой кадра — из-под слова — и
 * поднимается через весь кадр отдельными клубами. Плотность максимальна у
 * источника и падает по мере подъёма; к верхней трети поток истончается
 * до полной прозрачности. Разброс по глубине даёт объём: ближние клубы
 * крупнее и быстрее, дальние мельче и медленнее.
 *
 * Слово стоит близко к камере, поэтому основная масса пара идёт за ним и
 * вордмарк читается целиком. Перед словом остаётся только редкий
 * прозрачный ближний слой.
 *
 * По прогрессу сцены поток усиливается и поднимается выше, а слово
 * всплывает вместе с ним и растворяется.
 */
export function SteamVolume() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const box = host.current
    if (!box) return
    const stage = box.closest('.hero__stage') as HTMLElement | null
    if (!stage) return

    const sp = new URLSearchParams(window.location.search)
    const q = sp.get('steam')
    if (q === 'off') return
    if (q !== 'force') {
      if (reduced()) return
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
      if (window.innerWidth <= 860) return
    }

    let kill: Kill | null = null
    let dead = false
    const stepsQ = Number(sp.get('steps'))
    // Ручной шаг: снимальщик сам двигает часы, курсор и прогресс сцены.
    // Нужен потому, что на программном рендерере кадр идёт секунду.
    const manual = q === 'force' && sp.get('manual') === '1'
    start(stage, box, q === 'force', stepsQ, manual).then((k) => {
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
  stage: HTMLElement,
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
  stage.dataset.gl = '1'

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

  // ── Вордмарк и поле обтекания ──────────────────────────────────────
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

  let W = 0
  let H = 0

  /**
   * Раскладка слова. Кегль вписывается и в высоту экрана, и в его ширину,
   * поэтому срез нижней кромкой всегда одна и та же доля высоты литеры,
   * а по бокам слово не выходит за кадр ни на одном вьюпорте.
   */
  const layout = () => {
    const pad = Math.min(26, Math.max(10, W * 0.014))
    const sum = letters.reduce((a, c) => a + (m.adv[c] ?? 0.6), 0)
    const size = Math.min((0.22 * H) / m.capR, ((W - 2 * pad) / sum) * 0.94)
    const gap = (W - 2 * pad - sum * size) / (letters.length - 1)
    return { pad, size, gap, baseline: H + CROP * m.capR * size }
  }

  const paintWord = (ctx: CanvasRenderingContext2D, s: number, dy = 0) => {
    const { pad, size, gap, baseline } = layout()
    ctx.font = `${weight} ${size * s}px "${family}", Georgia, serif`
    ctx.textBaseline = 'alphabetic'
    let x = pad * s
    letters.forEach((c) => {
      ctx.fillText(c, x, (baseline + dy) * s)
      x += ((m.adv[c] ?? 0.6) * size + gap) * s
    })
  }

  const drawWord = () => {
    if (!W || !H) return
    if (wordCanvas.width !== W || wordCanvas.height !== H) {
      wordCanvas.width = W
      wordCanvas.height = H
    }
    wordCtx.clearRect(0, 0, W, H)
    wordCtx.fillStyle = '#f7f4ed'
    paintWord(wordCtx, 1)
    wordTex.needsUpdate = true
  }

  /**
   * Печёт гало снаружи литер: размытый силуэт минус сам силуэт. Внутри
   * буквы поля нет, поэтому между буквами поток проходит свободно, а у
   * кромки прижимается к контуру. Размытие здесь — операция сборки,
   * в кадре не повторяется.
   */
  const bakeField = () => {
    if (!W || !H) return
    const fw = Math.max(2, Math.round(W / 2))
    const fh = Math.max(2, Math.round(H / 2))
    fieldCanvas.width = fw
    fieldCanvas.height = fh

    const c = document.createElement('canvas')
    c.width = fw
    c.height = fh
    const x = c.getContext('2d')!
    x.fillStyle = '#fff'
    try {
      x.filter = 'blur(13px)'
    } catch {
      /* фильтра нет — поле останется резче, но работать будет */
    }
    paintWord(x, 0.5)
    x.filter = 'none'
    x.globalCompositeOperation = 'destination-out'
    paintWord(x, 0.5)
    x.globalCompositeOperation = 'source-over'

    const src = x.getImageData(0, 0, fw, fh).data
    const out = fieldCtx.createImageData(fw, fh)
    for (let i = 0; i < fw * fh; i++) {
      const j = i * 4
      out.data[j] = src[j + 3]
      out.data[j + 1] = 0
      out.data[j + 2] = 0
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
      uSteps: { value: stepsQ >= 6 && stepsQ <= 48 ? stepsQ : 26 },
      uProgress: { value: 0 },
      uWordRise: { value: 0 },
      uWordA: { value: 1 },
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
    W = stage.clientWidth
    H = stage.clientHeight
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
    const r = stage.getBoundingClientRect()
    p1.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height)
    active = 1
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
  stage.addEventListener('pointermove', onMove, { passive: true })
  stage.addEventListener('pointerleave', onLeave)

  // ── Сцена ушла из кадра — считать нечего ───────────────────────────
  let onScreen = true
  const io = new IntersectionObserver(
    ([e]) => {
      const was = onScreen
      onScreen = e.isIntersecting
      if (onScreen && !was && !stopped && !manual) {
        last = performance.now()
        raf = requestAnimationFrame(render)
      }
    },
    { threshold: 0 },
  )
  io.observe(stage)

  // ── Цикл ───────────────────────────────────────────────────────────
  let frame = 0
  let last = performance.now()
  let raf = 0
  const samples: number[] = []
  let watchdogDone = false
  let stopped = false
  const startedAt = performance.now()
  /** Ручной прогресс перебивает мастер-таймлайн только в снимальном режиме. */
  let manualProgress: number | null = null

  function render(now: number) {
    if (stopped) return
    if (!onScreen) {
      raf = 0
      return
    }
    if (!manual) raf = requestAnimationFrame(render)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (!W || !H) return
    if (!watchdogDone && dt > 0) samples.push(1 / dt)

    const pr = manualProgress ?? heroProgress()
    volMat.uniforms.uProgress.value = pr
    // Слово всплывает вместе с потоком и растворяется позже текста.
    volMat.uniforms.uWordRise.value = pr * 0.30
    volMat.uniforms.uWordA.value = 1 - smoothstep(0.44, 0.92, pr)

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
      // кадров вообще набралось. Машина, не осилившая шести кадров за
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
    let vnow = performance.now()
    ;(window as unknown as { __steam?: unknown }).__steam = {
      run(seconds: number, hz = 60) {
        const step = 1000 / hz
        const n = Math.max(1, Math.round(seconds * hz))
        for (let i = 0; i < n; i++) {
          vnow += step
          last = vnow - step
          render(vnow)
        }
      },
      point(cx: number, cy: number) {
        const r = stage.getBoundingClientRect()
        p1.set((cx - r.left) / r.width, 1 - (cy - r.top) / r.height)
        active = 1
      },
      leave() {
        active = 0
      },
      /** Поставить прогресс сцены, минуя мастер-таймлайн. */
      progress(v: number | null) {
        manualProgress = v
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
    stage.removeEventListener('pointermove', onMove)
    stage.removeEventListener('pointerleave', onLeave)
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
    delete stage.dataset.gl
    dispose()
  }

  return dispose
}

/** smoothstep без three: нужен один раз, тянуть математику не за чем. */
function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
