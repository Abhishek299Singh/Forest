/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        reserve: {
          50: '#f4f7f4',
          100: '#e3ece3',
          200: '#c6d9c6',
          300: '#9ebd9f',
          400: '#719d73',
          500: '#4e7e51',
          600: '#3c643f',
          700: '#315034',
          800: '#2a412c',
          900: '#233725',
          950: '#111d13',
        },
        field: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          850: '#162032',
          900: '#0f172a',
          950: '#0a0f1d',
        },
        amberGold: {
          500: '#d97706',
          600: '#b45309',
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
