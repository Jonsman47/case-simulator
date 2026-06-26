/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cs: {
          bg: 'rgb(var(--cs-bg) / <alpha-value>)',
          surface: 'rgb(var(--cs-surface) / <alpha-value>)',
          panel: 'rgb(var(--cs-panel) / <alpha-value>)',
          panelMuted: 'rgb(var(--cs-panel-muted) / <alpha-value>)',
          border: 'rgb(var(--cs-border) / <alpha-value>)',
          text: 'rgb(var(--cs-text) / <alpha-value>)',
          muted: 'rgb(var(--cs-muted) / <alpha-value>)',
          amber: 'rgb(var(--cs-amber) / <alpha-value>)',
          green: 'rgb(var(--cs-green) / <alpha-value>)',
        },
        rarity: {
          consumer: 'rgb(var(--rarity-consumer) / <alpha-value>)',
          industrial: 'rgb(var(--rarity-industrial) / <alpha-value>)',
          'mil-spec': 'rgb(var(--rarity-mil-spec) / <alpha-value>)',
          restricted: 'rgb(var(--rarity-restricted) / <alpha-value>)',
          classified: 'rgb(var(--rarity-classified) / <alpha-value>)',
          covert: 'rgb(var(--rarity-covert) / <alpha-value>)',
          special: 'rgb(var(--rarity-special) / <alpha-value>)',
          contraband: 'rgb(var(--rarity-contraband) / <alpha-value>)',
        },
      },
      boxShadow: {
        glow: '0 0 32px rgba(242, 184, 75, 0.18)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
