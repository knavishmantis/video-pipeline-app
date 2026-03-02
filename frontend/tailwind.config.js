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
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Luxury Matte tokens (light/dark via CSS vars)
        'gold':      '#B8922E',
        'gold-dark': '#D4AF50',
        'cream':     '#F5F2EC',
        'ink':       '#1C1A16',
      },
      boxShadow: {
        'card':    '0 1px 3px rgba(0,0,0,0.07), 0 0 0 1px rgba(28,22,14,0.06)',
        'modal':   '0 24px 64px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
