/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          950: '#07100a', // deep night canopy
          900: '#0c1a11', // dark moss undergrowth
          850: '#112217', // woodland card base
          800: '#162b1e', // spruce panel
          750: '#1c3525', // pine card hover
          700: '#23412e', // evergreen border
          600: '#2d523b', // forest green outline
          500: '#3d6e50', // moss green
          400: '#4e8d67', // leaf accent
          300: '#68b187', // light fern
          200: '#94cca9', // pale sage
          100: '#cbe7d7', // forest mist
          50: '#f0fdf4',  // parchment light
        },
        bark: {
          900: '#1a130e',
          800: '#2c1e15',
          700: '#422c1e',
          600: '#5e3f2b',
          500: '#8a5c3e',
          400: '#b87b53',
          300: '#d99f77',
        },
        amberGold: {
          600: '#b45309',
          500: '#d97706',
          400: '#f59e0b',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
