/**
 * Кодирует испечённые PNG в webp/avif. Это ровно тот случай, когда
 * ускорять можно: формат картинки невидим, движение не страдает.
 */
import sharp from 'sharp'
import { readdir, unlink, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'img')

const HERO = [
  { src: 'hero-desktop.png', widths: [1600, 2400] },
  { src: 'hero-mobile.png', widths: [800, 1200] },
]
// Конденсат — мягкий шум: он ничего не теряет от уменьшения и низкого q.
const FLAT = [
  { src: 'steam-1.png', q: 74, w: null },
  { src: 'steam-2.png', q: 74, w: null },
  { src: 'steam-3.png', q: 74, w: null },
  { src: 'fog.png', q: 58, w: 1000 },
  { src: 'frost.png', q: 62, w: 720 },
]

const kb = (n) => `${Math.round(n / 1024)} КБ`

for (const { src, widths } of HERO) {
  const base = src.replace('.png', '')
  const input = path.join(DIR, src)
  for (const w of widths) {
    await sharp(input).resize({ width: w }).avif({ quality: 52, effort: 6 })
      .toFile(path.join(DIR, `${base}-${w}.avif`))
    await sharp(input).resize({ width: w }).webp({ quality: 76, effort: 6 })
      .toFile(path.join(DIR, `${base}-${w}.webp`))
  }
  // Кадр по умолчанию — тот, что уйдёт в <img src>.
  const def = widths[widths.length - 1]
  await sharp(input).resize({ width: def }).avif({ quality: 52, effort: 6 })
    .toFile(path.join(DIR, `${base}.avif`))
  await sharp(input).resize({ width: def }).webp({ quality: 76, effort: 6 })
    .toFile(path.join(DIR, `${base}.webp`))
}

for (const { src, q, w } of FLAT) {
  const base = src.replace('.png', '')
  const out = path.join(DIR, `${base}.webp`)
  const pipe = sharp(path.join(DIR, src))
  if (w) pipe.resize({ width: w })
  await pipe.webp({ quality: q, alphaQuality: 78, effort: 6 }).toFile(out)
  if (base.startsWith('steam')) {
    await sharp(path.join(DIR, src))
      .resize({ width: 1200 })
      .webp({ quality: q, alphaQuality: 78, effort: 6 })
      .toFile(path.join(DIR, `${base}-1200.webp`))
  }
}

// PNG-исходники в выдаче не нужны — они тяжелее в разы.
for (const f of await readdir(DIR)) {
  if (f.endsWith('.png')) await unlink(path.join(DIR, f))
}

const rows = []
for (const f of (await readdir(DIR)).sort()) {
  rows.push([f, kb((await stat(path.join(DIR, f))).size)])
}
console.table(Object.fromEntries(rows))
