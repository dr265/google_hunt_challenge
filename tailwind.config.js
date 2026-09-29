/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        nexus: {
          bg: '#05070d',
          panel: '#0b0f1a',
          card: '#0e1424',
          edge: '#1c2740',
          accent: '#4f8dff',
          accent2: '#67e8f9',
          ok: '#34d399',
          warn: '#fbbf24',
          danger: '#f87171',
        },
      },
    },
  },
  plugins: [],
}
