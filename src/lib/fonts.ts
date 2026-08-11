import raw from './fonts.generated.json'

type Metrics = {
  id: string
  family: string
  role: 'display' | 'text'
  file: string
  variable: boolean
  wght: number[]
  bytes: number
  upm: number
  capR: number
  ascR: number
  descR: number
  adv: Record<string, number>
}

export const METRICS = raw as unknown as Record<string, Metrics>

/**
 * Насколько вордмарк уезжает под нижнюю кромку вьюпорта.
 *
 * Слово обрезается ровно на CROP высоты литеры. Чтобы попасть точно,
 * считаем от реальных метрик гарнитуры, а не подбираем число на глаз:
 *   базовая линия от низа строки (line-height: 1) = 0.5 − (asc + desc) / 2
 *   плюс отрезаемая часть литеры                  = CROP × capHeight
 */
const CROP = 0.34

export const wordmarkDrop = (m: Metrics) =>
  +(0.5 - (m.ascR + m.descR) / 2 + CROP * m.capR).toFixed(4)

/** Сумма ширин Т-Е-Р-М-А в эмах — по ней вписываем кегль в ширину экрана. */
export const wordmarkSum = (m: Metrics) =>
  +Object.values(m.adv).reduce((a, b) => a + b, 0).toFixed(4)

export type Pair = {
  id: string
  title: string
  display: string
  text: string
  foundry: string
  designer: string
  link: string
  price: string
  licence: string
  cyr: string
  rationale: string
}

/**
 * Три пары под сравнение. Все три отрисовываются по-настоящему —
 * файлы лежат в public/fonts, так что арт-директор сравнивает кадрами,
 * а не описаниями. Платные альтернативы — в CLAUDE.md и в отчёте.
 */
export const PAIRS: Pair[] = [
  {
    id: 'forum',
    title: 'Forum × Golos Text',
    display: 'forum',
    text: 'golos',
    foundry: 'Cyreal × ParaType',
    designer: 'Denis Masharov · Александра Королькова и др.',
    link: 'https://fonts.google.com/specimen/Forum',
    price: 'Бесплатно, SIL OFL 1.1 — включая коммерческое использование',
    licence: 'SIL Open Font License 1.1',
    cyr: 'Проверено по таблице cmap в бинарнике: 67 из 68 знаков — вся кириллица А–Я, а–я, ё и №. Нет только знака ₽, он берётся из текстовой гарнитуры.',
    rationale:
      'Forum нарисован от римского маюскула — того самого, которым подписывали термы. ' +
      'Кириллица построена на тех же пропорциях, что и латиница: узкие Е и Р, широкая Ж, ' +
      'диагонали У и Д без завитков. Контраст умеренный, засечки короткие и плоские — ' +
      'на кегле 350 px они читаются как фаска на камне, а не как украшение. ' +
      'В очень широком наборе слово не разъезжается: у литер прямые вертикали и мало ' +
      'выносных элементов, поэтому разрядка 200 px не превращает слово в набор значков. ' +
      'Golos Text рисовался как интерфейсный шрифт для госпорталов — это буквально ' +
      'проверенная на миллионах читателей нейтральность: открытые апертуры, ровный ритм, ' +
      'высокий x-height. В 11–13 px с трекингом держит строку без слипания.',
  },
  {
    id: 'tenor',
    title: 'Tenor Sans × Onest',
    display: 'tenorsans',
    text: 'onest',
    foundry: 'Cyreal × Rusfonts',
    designer: 'Denis Masharov · Андрей Шаронов',
    link: 'https://fonts.google.com/specimen/Tenor+Sans',
    price: 'Бесплатно, SIL OFL 1.1',
    licence: 'SIL Open Font License 1.1',
    cyr: 'Проверено по cmap: 67 из 68 — вся кириллица и №, знака ₽ нет, берём из текстовой гарнитуры.',
    rationale:
      'Tenor Sans — гуманистический антиквенный гротеск без засечек: пропорции ' +
      'римской капители, но штрих почти монолинейный. Кириллица здесь спокойнее, ' +
      'чем у Forum, — Д без выносных лап, З и Э с мягкими окончаниями, ' +
      'Ж собранная. Такой рисунок точнее рифмуется со стеклянным павильоном ' +
      'на снимке, чем историческая антиква. Кегль 350 px держит: штрих не рвётся, ' +
      'потому что модуляция минимальна. Onest — современный кириллический гротеск ' +
      'с девятью весами, чуть теплее Inter за счёт скруглённых внутренних углов.',
  },
  {
    id: 'prata',
    title: 'Prata × Manrope',
    display: 'prata',
    text: 'manrope',
    foundry: 'Cyreal × Mikhail Sharanda',
    designer: 'Иван Гладких · Михаил Шаранда',
    link: 'https://fonts.google.com/specimen/Prata',
    price: 'Бесплатно, SIL OFL 1.1',
    licence: 'SIL Open Font License 1.1',
    cyr: 'Проверено по cmap: 67 из 68 — вся кириллица и ₽, нет знака №. В макете № не встречается.',
    rationale:
      'Prata — дидон с высоким контрастом и самой большой высотой прописных ' +
      'из трёх (0.80 em против 0.66 у Forum): на той же высоте литеры слово ' +
      'занимает меньше вертикали и обрезка читается жёстче. Кириллица уверенная, ' +
      'с характерными каплевидными окончаниями у У и Р. Риск ровно один: тонкие ' +
      'соединительные штрихи на светлом кадре местами уходят в пар — это ' +
      'красиво, но на слабом экране слово теряет плотность. Manrope — открытый ' +
      'полугротеск с высоким x-height, семь весов, отличная кириллица от автора.',
  },
]

export const DEFAULT_PAIR = PAIRS[0]
