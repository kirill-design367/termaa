import type { Config } from 'tailwindcss'

/**
 * Tailwind здесь — служебный слой: сетка, отступы, флексы.
 * Цвет, типографика и моушн живут в токенах globals.css,
 * чтобы дизайн-система была одна, а не две.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        steam: 'var(--steam)',
        amber: 'var(--amber)',
        water: 'var(--water)',
        stone: {
          100: 'var(--stone-100)',
          200: 'var(--stone-200)',
          300: 'var(--stone-300)',
          400: 'var(--stone-400)',
          500: 'var(--stone-500)',
          600: 'var(--stone-600)',
          700: 'var(--stone-700)',
          800: 'var(--stone-800)',
          900: 'var(--stone-900)',
        },
      },
      fontFamily: {
        display: 'var(--font-display)',
        text: 'var(--font-text)',
      },
      screens: { xs: '400px', wide: '1600px' },
    },
  },
  plugins: [],
} satisfies Config
