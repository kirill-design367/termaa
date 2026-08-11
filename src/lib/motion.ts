/**
 * Таблица длительностей и кривых. Единственный источник —
 * из него читают и CSS-токены, и GSAP. Линейных переходов нет нигде.
 */
export const D = {
  xs: 0.18, //  микро: фокус, подсветка поля
  s: 0.32, //  кнопка, ссылка, ховер
  m: 0.62, //  появление элемента блока
  l: 1.2, //  затягивание пара обратно
  xl: 2.2, //  вход страницы целиком
} as const

export const E = {
  /** Основной выход. Резкий старт, длинный выкат. */
  out: 'expo.out',
  outCss: 'cubic-bezier(.16, 1, .3, 1)',
  /** Смена состояния: аккордеон, таб. */
  inOut: 'power3.inOut',
  inOutCss: 'cubic-bezier(.65, 0, .35, 1)',
  /** Пар. Вязкий, без щелчка на конце. */
  steam: 'power2.out',
  steamCss: 'cubic-bezier(.33, 0, .15, 1)',
  /** Капля. Разгон под тяжестью. */
  drop: 'power2.in',
  dropCss: 'cubic-bezier(.55, .06, .68, .19)',
  /** Дверной проём между зонами. */
  door: 'power4.inOut',
} as const

export const STAGGER = {
  letters: 0.05, //  литеры вордмарка
  lines: 0.08, //  строки заголовка
  ui: 0.05, //  шапка, кнопки, лид
} as const

/** Пользователь просил не двигать — не двигаем. */
export const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
