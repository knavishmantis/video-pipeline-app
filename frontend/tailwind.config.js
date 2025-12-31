/** @type {import('tailwindcss').Config} */
export default {
  darkMode: false, // Disable dark mode - always use light mode
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        'input': 'var(--shadow-input)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
