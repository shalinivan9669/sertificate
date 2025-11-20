/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './composables/**/*.{js,ts}',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0f172a',
          accent: '#2b7a78',
          soft: '#e9f1f0',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      container: {
        center: true,
        padding: '1.25rem',
      },
    },
  },
  plugins: [],
};
