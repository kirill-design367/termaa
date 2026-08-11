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
  /** Вес, которым набирается вордмарк и крупные заголовки. */
  displayWeight: number
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
 * Кандидаты на замену. Forum, Prata и Tenor Sans выведены из проекта —
 * арт-директор забраковал их как самые заезженные «премиальные»
 * гарнитуры русского веба.
 *
 * Все три пары ниже отрисовываются настоящими файлами: витрина должна
 * показывать кадр, а не описание. Платные кандидаты из русских студий
 * перечислены в CLAUDE.md — их файлы за периметром сборки недоступны.
 */
export const PAIRS: Pair[] = [
  {
    id: 'golos',
    title: 'Golos Text 900 × Golos Text 400',
    display: 'golos',
    displayWeight: 900,
    text: 'golos',
    foundry: 'ParaType',
    designer: 'Александра Королькова, Виталий Кузьмин',
    link: 'https://www.paratype.ru/fonts/pt/golos-text',
    price: 'Бесплатно, SIL OFL 1.1 — включая коммерческое использование',
    licence: 'SIL Open Font License 1.1',
    cyr: 'Кириллица первична: гарнитура рисовалась под русский текст, латиница добавлена к ней, а не наоборот. По cmap 68 из 68 знаков, включая ₽ и №.',
    rationale:
      'Это то, что стоит в бою прямо сейчас — по вашему указанию, до выбора новой пары. ' +
      'Одна гарнитура в двух крайних весах вместо пары: 900 на вордмарк и крупные ' +
      'заголовки, 400 на текст. Расчёт на то, что контраст даёт вес и кегль, а не ' +
      'смена рисунка. У Golos прямые вертикали, крупный очковый размер и очень ровный ' +
      'ритм — на кегле 350 px тяжёлое начертание держится как вырубка по камню, без ' +
      'ложной парадности, которой грешат антиквы с Тильды. Минус честный: характера ' +
      'у неё меньше, чем у выделенной акциденции, — это рабочая нейтральность, а не ' +
      'высказывание.',
  },
  {
    id: 'unbounded',
    title: 'Unbounded × Onest',
    display: 'unbounded',
    displayWeight: 500,
    text: 'onest',
    foundry: 'NaN × Onest',
    designer: 'Luke Prowse и др. · Дмитрий Волошин, Андрей Кудрявцев',
    link: 'https://fonts.google.com/specimen/Unbounded',
    price: 'Бесплатно, SIL OFL 1.1',
    licence: 'SIL Open Font License 1.1',
    cyr: 'Кириллица входит в семейство с релиза и нарисована вместе с латиницей, но студия западная — это не кириллица-первоисточник. По cmap 68 из 68.',
    rationale:
      'Геометрический гротеск с очень широкими прописными и почти монолинейным ' +
      'штрихом. В горизонтальном наборе во всю ширину экрана это его родная стихия: ' +
      'круглые О и С держат разрядку в 200 px, слово не рассыпается на значки. ' +
      'Кириллица спокойная — Д без выносных лап, Ж собранная, З без завитка. ' +
      'На Тильде такого нет: гарнитура молодая и читается как современная айдентика, ' +
      'а не как ресторанная вывеска. Onest под текст — родная кириллица, девять весов, ' +
      'высокий очковый размер, держит 11 px с трекингом.',
  },
  {
    id: 'podkova',
    title: 'Podkova × Manrope',
    display: 'podkova',
    displayWeight: 700,
    text: 'manrope',
    foundry: 'Cyreal × Михаил Шаранда',
    designer: 'Илья Юдин · Михаил Шаранда',
    link: 'https://fonts.google.com/specimen/Podkova',
    price: 'Бесплатно, SIL OFL 1.1',
    licence: 'SIL Open Font License 1.1',
    cyr: 'Рисовалась в Cyreal под кириллицу, латиница вторична. По cmap 68 из 68.',
    rationale:
      'Брусковая антиква с короткими плотными засечками и низким контрастом. ' +
      'Самая маленькая высота прописных из трёх (0.59 em) — значит на той же высоте ' +
      'литеры слово занимает больше вертикали и обрезка нижней кромкой читается ' +
      'мягче. Характер тёплый и тяжёлый, ближе к дереву и камню, чем к стеклу: ' +
      'для термального комплекса это попадание в материал. Риск: брусковые засечки ' +
      'на очень широком наборе начинают спорить с воздухом между литерами — ' +
      'смотреть надо именно на вордмарке, что витрина и позволяет.',
  },
]

/** В бою — Golos Text, по прямому указанию арт-директора. */
export const DEFAULT_PAIR = PAIRS[0]
