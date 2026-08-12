/** Кодирует четыре кадра зон в три формата и два размера. */
import sharp from 'sharp'
import { statSync } from 'node:fs'
const SRC='/workspace/termaa/assets-src', OUT='/workspace/termaa/public/img'
const kb=f=>Math.round(statSync(f).size/1024)+'КБ'
for (const n of ['zone-pool','zone-parnaya','zone-hamam','zone-kupel']) {
  const src=`${SRC}/${n}.jpg`
  for (const w of [1600, 2400]) {
    await sharp(src).resize({width:w}).avif({quality:50,effort:6}).toFile(`${OUT}/${n}-${w}.avif`)
    await sharp(src).resize({width:w}).webp({quality:74,effort:6}).toFile(`${OUT}/${n}-${w}.webp`)
  }
  // JPEG-фолбэк один, среднего размера.
  await sharp(src).resize({width:1600}).jpeg({quality:76,mozjpeg:true,progressive:true}).toFile(`${OUT}/${n}.jpg`)
  console.log(n,
    'avif', kb(`${OUT}/${n}-1600.avif`), kb(`${OUT}/${n}-2400.avif`),
    '· webp', kb(`${OUT}/${n}-1600.webp`), kb(`${OUT}/${n}-2400.webp`),
    '· jpeg', kb(`${OUT}/${n}.jpg`))
}
