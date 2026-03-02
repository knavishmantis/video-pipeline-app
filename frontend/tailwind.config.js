/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        mono: ['DM Mono', 'Courier New', 'monospace'],
      },
      colors: {
        'pipe': {
          'base':     '#0E0E12',
          'surface':  '#16161C',
          'elevated': '#1C1C24',
          'raised':   '#22222C',
          'border':   '#2E2E3C',
          'muted':    '#4A4A60',
          'secondary':'#8888A8',
          'primary':  '#EEEEF5',
          'accent':   '#F5A623',
          'green':    '#22D3A0',
          'red':      '#FF5E5E',
          'blue':     '#5C8EFF',
          'violet':   '#B39DFF',
          'lime':     '#A3E635',
        },
      },
      boxShadow: {
        'glow-amber': '0 0 24px rgba(245, 166, 35, 0.3)',
        'glow-green': '0 0 16px rgba(34, 211, 160, 0.25)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
