'use client'

import { useEffect, useRef } from 'react'
import { A } from '@/lib/asset'
import { reduced } from '@/lib/motion'
import {
  POOL_DESKTOP,
  POOL_MOBILE,
  WATER_LINE,
  WATER_NEAR,
  cover,
  inPoly,
  poolRect,
  toImage,
  type Cover,
} from '@/lib/water'

/**
 * Вода в кадре героя.
 *
 * Приём один и работает только там, где на фотографии вода. Постоянно —
 * медленная рябь; под курсором — концентрические волны, которые идут по
 * поверхности, гаснут к краям и живут 1.5 с. И рябь, и волны смещают
 * пиксель фотографии, поэтому вместе с водой искажается и отражение гор
 * в ней: отражение не нарисовано, оно снято с кадра.
 *
 * Холст лежит РОВНО на габарите бассейна, а не во весь экран, и за его
 * пределами не существует. Маски во весь кадр нет ни одной: область
 * задана испечённым полигоном, который читается в шейдере как текстура.
 * Где маска в нуле — холст прозрачен, и сквозь него видна нетронутая
 * фотография; поэтому кромки области не видно.
 *
 * Отражение заголовка — часть приёма, а не отдельный слой: зеркальная
 * копия рисуется в текстуру один раз и внутри шейдера смещается той же
 * рябью, что и вода. Сжатие по вертикали — перспектива: плоскость воды
 * уходит от камеры, и отражение обязано укорачиваться.
 */

const MAX_DROPS = 4
const DROP_LIFE = 1.5

const VERT = `#version 300 es
in vec2 a;
out vec2 vUv;
void main(){
  vUv = vec2(a.x, 1.0 - a.y);
  gl_Position = vec4(a * 2.0 - 1.0, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 o;

uniform sampler2D uPhoto;
uniform sampler2D uMask;
uniform sampler2D uRefl;
uniform vec4  uImg;      // xy — начало кадра, zw — размах в долях фотографии
uniform vec2  uBand;     // x — линия воды, y — ближняя кромка (доли кадра)
uniform float uTime;
uniform float uAmp;
uniform float uRefA;     // проявление отражения на входе
uniform float uFade;     // общая сила приёма
uniform vec3  uDrops[${MAX_DROPS}];   // xy — центр в плоскости, z — время рождения

/* Плоскость воды. Камера смотрит вдоль неё, поэтому дальний край сжат:
   глубина идёт как 1/z, а не линейно. Без этого рябь у линии воды была
   бы такой же крупной, как под ногами, — и читалась бы как ткань. */
vec2 plane(vec2 img, out float z){
  float d = clamp((img.y - uBand.x) / (uBand.y - uBand.x), 0.0, 1.0);
  z = 1.0 / (d * 0.92 + 0.08);
  return vec2((img.x - 0.42) * z * 9.0, z * 1.15);
}

/*
 * Наклон поверхности воды.
 *
 * Считается АНАЛИТИЧЕСКИ, а не тремя выборками высоты вокруг точки.
 * Разностная схема требовала трёх полных вычислений поля на пиксель —
 * ровно втрое больше работы за тот же результат, потому что производная
 * суммы синусов и гауссиан берётся в уме. Ни один пиксель от этого не
 * изменился: разностная схема и была приближением к этим формулам.
 */
vec2 slope(vec2 p){
  /* Постоянная рябь. Три несоизмеримые волны: гребни вытянуты вдоль
     берега — так стоит вода на самом деле, — но не параллельны ему,
     у каждой свой наклон, иначе поверхность собирается в полосы.
     Амплитуда намеренно мала: рябь обязана быть на грани заметности,
     иначе под ней тонет всё остальное. */
  const float A = 0.34;
  float c1 = cos(p.y * 6.1  + p.x * 3.3 + uTime * 0.55);
  float c2 = cos(p.y * 9.7  - p.x * 5.1 + uTime * 0.37) * 0.55;
  float c3 = cos(p.y * 15.3 + p.x * 8.7 - uTime * 0.71) * 0.28;
  vec2 g = vec2(
    A * ( 3.3 * c1 - 5.1 * c2 +  8.7 * c3),
    A * ( 6.1 * c1 + 9.7 * c2 + 15.3 * c3)
  );

  /* Волны от курсора. Кольцо идёт от точки наружу, гаснет к краям и
     живёт полторы секунды. Амплитуда выше фоновой — иначе приём не
     читается: он и есть событие в кадре. */
  for (int i = 0; i < ${MAX_DROPS}; i++){
    vec3 d = uDrops[i];
    float age = uTime - d.z;
    if (age < 0.0 || age > ${DROP_LIFE}) continue;
    vec2 v = p - d.xy;
    float r = max(length(v), 1e-4);
    float s = r - age * 1.6;
    /* Полоса фронта шире длины волны — в ней укладывается три-четыре
       гребня, и кольца читаются кольцами, а не одним горбом. */
    float ring = exp(-0.64 * s * s);
    /* Затухание мягче квадрата: на квадрате волна пропадала к 0.9 с,
       то есть жила вдвое меньше положенного. */
    float life = 1.0 - age / ${DROP_LIFE};
    float amp = life * (0.3 + 0.7 * life) * 2.2 * exp(-0.5 * r) * ring;
    float dr = amp * (13.0 * cos(13.0 * s) - sin(13.0 * s) * (1.28 * s + 0.5));
    g += dr * v / r;
  }
  return g;
}

void main(){
  vec2 img = uImg.xy + vUv * uImg.zw;
  float m = texture(uMask, img).r;
  if (m < 0.004) discard;

  float z;
  vec2 p = plane(img, z);

  /* Наклон берём в плоскостных единицах и переводим обратно в кадр:
     дальняя рябь смещает пиксель слабее ближней ровно во столько раз,
     во сколько она дальше. */
  vec2 g = slope(p);

  float d = clamp((img.y - uBand.x) / (uBand.y - uBand.x), 0.0, 1.0);
  /* Смещение гаснет у ОБЕИХ кромок области, и гаснет быстрее самой
     маски. Иначе на растушёвке маски пиксель ещё едет, а воды под ним
     уже нет — камень затягивает в воду, и по кадру идёт волнистая
     черта. Ровно тот же шов, только по нижней кромке. */
  float edge = smoothstep(0.0, 0.12, d) * smoothstep(1.0, 0.84, d);
  float k = edge * m * m * m * uFade;
  vec2 off = g * uAmp * k / vec2(z * 9.0, z * 1.15);

  vec3 col = texture(uPhoto, img + off).rgb;

  vec4 rf = texture(uRefl, vUv + off / uImg.zw);
  float deep = 1.0 - smoothstep(0.10, 0.95, d);
  col = mix(col, rf.rgb, rf.a * 0.18 * uRefA * deep * m);

  o = vec4(col, m);
}`

type Drop = { x: number; y: number; t: number }

export function Water() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const box = host.current
    if (!box) return
    const stage = box.parentElement as HTMLElement | null
    const img = stage?.querySelector('.hero__bg img') as HTMLImageElement | null
    const wm = stage?.querySelector('.wm') as HTMLElement | null
    if (!stage || !img || !wm) return

    const still = reduced()
    let cleanup = () => {}
    let dead = false
    let raf = 0
    let gl: WebGL2RenderingContext | null = null
    let ro: ResizeObserver | null = null
    let io: IntersectionObserver | null = null

    /* Приём подключается ПОСЛЕ первого кадра: до отрисовки фотографии и
       текста здесь не должно считаться ничего. Два кадра ожидания — это
       гарантия, что разметка уже на экране, а не обещание планировщика. */
    const boot = () => {
      if (dead) return
      // Приём можно снять для замера: так видно, сколько стоит он сам,
      // а сколько — всё остальное на странице.
      if (new URLSearchParams(location.search).get('water') === 'off') return
      const canvas = document.createElement('canvas')
      canvas.className = 'water__c'
      box.appendChild(canvas)

      gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: 'low-power',
      })
      // Без WebGL2 воды просто нет: фотография остаётся нетронутой, а
      // композиция от этого не рассыпается.
      if (!gl) return

      const g = gl
      const sh = (t: number, src: string) => {
        const s = g.createShader(t)!
        g.shaderSource(s, src)
        g.compileShader(s)
        return s
      }
      const prog = g.createProgram()!
      g.attachShader(prog, sh(g.VERTEX_SHADER, VERT))
      g.attachShader(prog, sh(g.FRAGMENT_SHADER, FRAG))
      g.bindAttribLocation(prog, 0, 'a')
      g.linkProgram(prog)
      if (!g.getProgramParameter(prog, g.LINK_STATUS)) return
      g.useProgram(prog)

      const buf = g.createBuffer()
      g.bindBuffer(g.ARRAY_BUFFER, buf)
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), g.STATIC_DRAW)
      g.enableVertexAttribArray(0)
      g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0)

      const U = (n: string) => g.getUniformLocation(prog, n)
      const uImg = U('uImg')
      const uBand = U('uBand')
      const uTime = U('uTime')
      const uAmp = U('uAmp')
      const uRefA = U('uRefA')
      const uFade = U('uFade')
      const uDrops = U('uDrops')

      const mkTex = (unit: number) => {
        const t = g.createTexture()
        g.activeTexture(g.TEXTURE0 + unit)
        g.bindTexture(g.TEXTURE_2D, t)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
        return t
      }
      const texPhoto = mkTex(0)
      const texMask = mkTex(1)
      const texRefl = mkTex(2)
      g.uniform1i(U('uPhoto'), 0)
      g.uniform1i(U('uMask'), 1)
      g.uniform1i(U('uRefl'), 2)

      // Фотография берётся из уже отрисованного <img>: тот же битмап,
      // второй загрузки и второго декодирования не происходит.
      g.activeTexture(g.TEXTURE0)
      g.bindTexture(g.TEXTURE_2D, texPhoto)
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img)

      g.enable(g.BLEND)
      g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA)
      g.clearColor(0, 0, 0, 0)

      const mob = () => window.matchMedia('(max-width: 860px)').matches
      let poly = mob() ? POOL_MOBILE : POOL_DESKTOP
      let cv: Cover = { ox: 0, oy: 0, dw: 1, dh: 1 }
      let rect = { x: 0, y: 0, w: 1, h: 1 }
      let ready = false

      // Маска области. 6 КБ, грузится после первого кадра.
      const mask = new Image()
      mask.decoding = 'async'
      mask.onload = () => {
        if (dead) return
        g.activeTexture(g.TEXTURE1)
        g.bindTexture(g.TEXTURE_2D, texMask)
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, mask)
        ready = true
        if (still) draw(0)
        else if (!raf && vis) raf = requestAnimationFrame(tick)
      }

      const refl = document.createElement('canvas')
      const rctx = refl.getContext('2d')!

      /**
       * Зеркальная копия имени.
       *
       * Слово стоит В ЧАШЕ бассейна, поэтому зеркало проходит по его
       * БАЗОВОЙ ЛИНИИ, а не по дальней кромке воды: отражается предмет
       * от той поверхности, в которой он стоит.
       *
       * Геометрия берётся с живых литер — начало, базовая линия и кегль
       * читаются с разметки, а не пересчитываются заново. Разъехаться с
       * именем отражение не может ни при каком кегле.
       *
       * Сжатие по вертикали — перспектива: плоскость воды уходит от
       * камеры, и отражение обязано укорачиваться.
       */
      const drawRefl = (dpr: number) => {
        refl.width = Math.max(1, Math.round(rect.w * dpr))
        refl.height = Math.max(1, Math.round(rect.h * dpr))
        rctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        rctx.clearRect(0, 0, rect.w, rect.h)

        // Мерятся ЛИТЕРНЫЕ БОКСЫ, а не сами литеры: на входе литера едет
        // снизу, и её прямоугольник в этот момент лежит на 120 % ниже
        // конечного места. Отражение, снятое с него, уезжало за кромку
        // холста — то есть его просто не было видно.
        const letters = wm.querySelectorAll<HTMLElement>('i')
        if (!letters.length) return
        const sr = stage.getBoundingClientRect()
        const cs = getComputedStyle(wm)
        // Чернила отражения — своя переменная: на десктопе вода под
        // словом светлая и отражение тёмное, на мобильной вода тёмная
        // и тёмное отражение в ней невидимо физически. Значение читается
        // с узла, а не из переменной: `getPropertyValue` отдаёт
        // неразвёрнутый `var(--ink)`, а не цвет.
        const inkEl = wm.querySelector('.wm__ink')
        rctx.fillStyle = inkEl ? getComputedStyle(inkEl).color : cs.color
        rctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
        rctx.textBaseline = 'alphabetic'

        const m0 = rctx.measureText('H')
        const asc = m0.fontBoundingBoxAscent || 0
        const desc = m0.fontBoundingBoxDescent || 0

        // Базовая линия слова в координатах холста.
        const first = letters[0].getBoundingClientRect()
        const base = first.top - sr.top - rect.y + (first.height - (asc + desc)) / 2 + asc

        rctx.save()
        rctx.translate(0, base)
        rctx.scale(1, -0.62)
        letters.forEach((el) => {
          const r = el.getBoundingClientRect()
          rctx.fillText(el.textContent || '', r.left - sr.left - rect.x, 0)
        })
        rctx.restore()

        g.activeTexture(g.TEXTURE2)
        g.bindTexture(g.TEXTURE_2D, texRefl)
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, refl)
      }

      const layout = () => {
        const w = stage.clientWidth
        const h = stage.clientHeight
        if (!w || !h) return
        poly = mob() ? POOL_MOBILE : POOL_DESKTOP
        cv = cover(w, h, img.naturalWidth || 2752, img.naturalHeight || 1536)
        rect = poolRect(cv, poly, 2)
        // Дальше площадки холст не выходит: за её краем рисовать нечего.
        rect.x = Math.max(0, rect.x)
        rect.y = Math.max(0, rect.y)
        rect.w = Math.min(w - rect.x, rect.w)
        rect.h = Math.min(h - rect.y, rect.h)

        const dpr = Math.min(2, window.devicePixelRatio || 1)
        canvas.style.left = `${rect.x}px`
        canvas.style.top = `${rect.y}px`
        canvas.style.width = `${rect.w}px`
        canvas.style.height = `${rect.h}px`
        canvas.width = Math.max(1, Math.round(rect.w * dpr))
        canvas.height = Math.max(1, Math.round(rect.h * dpr))
        g.viewport(0, 0, canvas.width, canvas.height)

        g.uniform4f(uImg, (rect.x - cv.ox) / cv.dw, (rect.y - cv.oy) / cv.dh, rect.w / cv.dw, rect.h / cv.dh)
        g.uniform2f(
          uBand,
          mob() ? WATER_LINE.mobile : WATER_LINE.desktop,
          mob() ? WATER_NEAR.mobile : WATER_NEAR.desktop,
        )
        g.uniform1f(uAmp, 0.00055)
        drawRefl(dpr)
        if (still && ready) draw(0)
      }

      const drops: Drop[] = []
      const buf3 = new Float32Array(MAX_DROPS * 3)
      let t0 = 0
      let vis = true

      const draw = (t: number) => {
        for (let i = 0; i < MAX_DROPS; i++) {
          const d = drops[i]
          buf3[i * 3] = d ? d.x : 0
          buf3[i * 3 + 1] = d ? d.y : 0
          buf3[i * 3 + 2] = d ? d.t : -99
        }
        g.uniform3fv(uDrops, buf3)
        g.uniform1f(uTime, t)
        g.uniform1f(uRefA, refA)
        g.uniform1f(uFade, 1)
        g.clear(g.COLOR_BUFFER_BIT)
        g.drawArrays(g.TRIANGLE_STRIP, 0, 4)
      }

      // В режиме покоя отражение стоит сразу: оно часть композиции, а не
      // движения. Гасить его вместе с анимацией — значит выкинуть из
      // кадра половину приёма.
      let refA = still ? 1 : 0
      // Заморозка времени для пробы: без неё приём не измерить — рябь
      // идёт всегда, и разницу между кадрами не отделить от волны.
      let frozen: number | null = null
      const tick = (now: number) => {
        raf = 0
        if (dead || !vis) return
        // Маска ещё летит — ждём её кадрами, а не выходом из цикла:
        // выход отсюда останавливал воду навсегда, потому что обратно
        // цикл запускал только наблюдатель видимости.
        if (!ready) {
          raf = requestAnimationFrame(tick)
          return
        }
        if (!t0) t0 = now
        const t = frozen ?? (now - t0) / 1000
        // Имя собирается к 1.09 с. Отражение проступает следом, с
        // задержкой 0.3 от того момента, как встала первая литера.
        if (refA < 1) refA = Math.min(1, (t - 1.15) / 0.3)
        while (drops.length && t - drops[0].t > DROP_LIFE) drops.shift()
        draw(t)
        raf = requestAnimationFrame(tick)
      }

      const onPoint = (e: PointerEvent) => {
        const sr = stage.getBoundingClientRect()
        const { u, v } = toImage(cv, e.clientX - sr.left, e.clientY - sr.top)
        // Вне воды курсор не делает ничего.
        if (!inPoly(poly, u, v)) return
        const t = t0 ? (performance.now() - t0) / 1000 : 0
        const last = drops[drops.length - 1]
        // Курсор сыплет события чаще, чем вода успевает ответить.
        if (last && t - last.t < 0.11) return
        const p = planeJs(u, v, mob())
        if (drops.length >= MAX_DROPS) drops.shift()
        drops.push({ x: p.x, y: p.y, t })
      }

      layout()
      mask.src = A(mob() ? '/img/pool-mobile.webp' : '/img/pool-desktop.webp')

      ro = new ResizeObserver(layout)
      ro.observe(stage)
      // Кегль имени ставит JS уже после первой раскладки и ещё раз по
      // готовности гарнитуры. Площадка при этом не меняется, поэтому
      // наблюдать надо и за самим словом — иначе отражение останется
      // от старого кегля.
      ro.observe(wm)

      if (!still) {
        stage.addEventListener('pointermove', onPoint, { passive: true })
        io = new IntersectionObserver(
          ([en]) => {
            vis = en.isIntersecting
            if (vis && !raf) raf = requestAnimationFrame(tick)
          },
          { rootMargin: '10% 0px' },
        )
        io.observe(stage)
      }

      // Диагностика приёма: снимальщик читает состояние воды.
      // В бою не включается.
      if (new URLSearchParams(location.search).get('water') === '1') {
        ;(window as unknown as { __water?: unknown }).__water = {
          drops,
          hit: (x: number, y: number) => {
            const sr = stage.getBoundingClientRect()
            const q = toImage(cv, x - sr.left, y - sr.top)
            return { ...q, in: inPoly(poly, q.u, q.v) }
          },
          state: () => ({ ready, vis, t0, raf, n: drops.length }),
          reflStat: () => {
            const d = rctx.getImageData(0, 0, refl.width, refl.height).data
            let n = 0
            let minY = 1e9
            let maxY = -1
            for (let y = 0; y < refl.height; y++)
              for (let x = 0; x < refl.width; x++) {
                if (d[(y * refl.width + x) * 4 + 3] > 8) {
                  n++
                  if (y < minY) minY = y
                  if (y > maxY) maxY = y
                }
              }
            return { size: [refl.width, refl.height], painted: n, minY, maxY, rect }
          },
          setRefl: (v: number) => {
            refA = v
          },
          clearRefl: () => {
            rctx.clearRect(0, 0, rect.w, rect.h)
            g.activeTexture(g.TEXTURE2)
            g.bindTexture(g.TEXTURE_2D, texRefl)
            g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, refl)
          },
          freeze: (v: number | null) => {
            frozen = v
            refA = 1
            if (!raf) raf = requestAnimationFrame(tick)
          },
          poke: (x: number, y: number, at: number) => {
            const sr = stage.getBoundingClientRect()
            const q = toImage(cv, x - sr.left, y - sr.top)
            const pp = planeJs(q.u, q.v, mob())
            drops.length = 0
            drops.push({ x: pp.x, y: pp.y, t: at })
          },
          clear: () => {
            drops.length = 0
          },
        }
      }

      cleanup = () => {
        stage.removeEventListener('pointermove', onPoint)
      }
    }

    // Два кадра: первый отдаёт разметку, второй гарантирует, что она
    // уже на экране. Только после этого поднимается контекст.
    const w1 = requestAnimationFrame(() => requestAnimationFrame(boot))

    return () => {
      dead = true
      cancelAnimationFrame(w1)
      if (raf) cancelAnimationFrame(raf)
      ro?.disconnect()
      io?.disconnect()
      cleanup()
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  return <div className="water" ref={host} aria-hidden="true" />
}

/** Те же плоскостные координаты, что в шейдере, — для попадания курсора. */
function planeJs(u: number, v: number, mobile: boolean) {
  const top = mobile ? WATER_LINE.mobile : WATER_LINE.desktop
  const bot = mobile ? WATER_NEAR.mobile : WATER_NEAR.desktop
  const d = Math.min(1, Math.max(0, (v - top) / (bot - top)))
  const z = 1 / (d * 0.92 + 0.08)
  return { x: (u - 0.42) * z * 9.0, y: z * 1.15, z }
}
