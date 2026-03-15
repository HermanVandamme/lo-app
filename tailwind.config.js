/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#E67E22',
          dark:    '#CA6F1E',
          light:   '#F0A060',
        }
      }
    },
  },
  plugins: [],
}
