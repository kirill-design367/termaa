/**
 * Трёхмерное шумовое поле для объёмного пара.
 *
 * Марш идёт 24–28 шагами на пиксель, и на каждом шаге нужна плотность.
 * Считать её аналитически — это десяток вычислений шума на шаг, то есть
 * сотни миллионов операций на кадр. Поэтому поле печётся один раз в
 * трёхмерную текстуру, а в шейдере остаётся одна выборка.
 *
 * Поле тайлится по всем трём осям: объём дрейфует бесконечно, шва нет.
 *
 * Каналы:
 *   R — крупная форма, 4 октавы от частоты 4
 *   G — средняя, 3 октавы от 8
 *   B — мелкая, 2 октавы от 16
 *   A — клубы: инвертированный Ворлей, он даёт валики и пузыри,
 *       которых у обычного фрактального шума нет
 */

const SIZE = 64

/** Быстрый детерминированный хеш на целых. */
function hash(x: number, y: number, z: number): number {
  let h = x * 374761393 + y * 668265263 + z * 1274126177
  h = (h ^ (h >>> 13)) >>> 0
  h = Math.imul(h, 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

const fade = (t: number) => t * t * (3 - 2 * t)

/** Значение шума с периодом `period` — отсюда бесшовность. */
function valueNoise(x: number, y: number, z: number, period: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = fade(x - xi)
  const yf = fade(y - yi)
  const zf = fade(z - zi)
  const w = (n: number) => ((n % period) + period) % period

  const x0 = w(xi)
  const x1 = w(xi + 1)
  const y0 = w(yi)
  const y1 = w(yi + 1)
  const z0 = w(zi)
  const z1 = w(zi + 1)

  const c000 = hash(x0, y0, z0)
  const c100 = hash(x1, y0, z0)
  const c010 = hash(x0, y1, z0)
  const c110 = hash(x1, y1, z0)
  const c001 = hash(x0, y0, z1)
  const c101 = hash(x1, y0, z1)
  const c011 = hash(x0, y1, z1)
  const c111 = hash(x1, y1, z1)

  const a = c000 + (c100 - c000) * xf
  const b = c010 + (c110 - c010) * xf
  const c = c001 + (c101 - c001) * xf
  const d = c011 + (c111 - c011) * xf
  const e = a + (b - a) * yf
  const f = c + (d - c) * yf
  return e + (f - e) * zf
}

function fbm(u: number, v: number, w: number, freq: number, oct: number): number {
  let sum = 0
  let amp = 0.5
  let norm = 0
  let f = freq
  for (let i = 0; i < oct; i++) {
    sum += valueNoise(u * f, v * f, w * f, f) * amp
    norm += amp
    amp *= 0.5
    f *= 2
  }
  return sum / norm
}

/** Ворлей с периодом: расстояние до ближайшей точки в решётке ячеек. */
function worley(u: number, v: number, w: number, cells: number): number {
  const x = u * cells
  const y = v * cells
  const z = w * cells
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  let best = 1e9
  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = xi + dx
        const cy = yi + dy
        const cz = zi + dz
        const wx = ((cx % cells) + cells) % cells
        const wy = ((cy % cells) + cells) % cells
        const wz = ((cz % cells) + cells) % cells
        const px = cx + hash(wx, wy, wz)
        const py = cy + hash(wx + 71, wy + 13, wz + 37)
        const pz = cz + hash(wx + 5, wy + 97, wz + 23)
        const d = (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2
        if (d < best) best = d
      }
    }
  }
  return Math.min(1, Math.sqrt(best))
}

export type Noise3D = { data: Uint8Array; size: number }

/** Печёт поле. Занимает ~40 мс на 64³ и делается один раз за сессию. */
export function bakeNoise3D(): Noise3D {
  const n = SIZE
  const data = new Uint8Array(n * n * n * 4)
  let i = 0
  for (let z = 0; z < n; z++) {
    const w = z / n
    for (let y = 0; y < n; y++) {
      const v = y / n
      for (let x = 0; x < n; x++) {
        const u = x / n
        data[i++] = fbm(u, v, w, 4, 4) * 255
        data[i++] = fbm(u, v, w, 8, 3) * 255
        data[i++] = fbm(u, v, w, 16, 2) * 255
        // Инверсия даёт валики: единица в центре ячейки, ноль на границах.
        data[i++] = (1 - worley(u, v, w, 8)) * 255
      }
    }
  }
  return { data, size: n }
}
