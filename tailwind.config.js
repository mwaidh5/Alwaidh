/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        sun: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        // Tiandy Iraq brand green (from the official logo).
        tiandy: {
          50: '#f1fdf1',
          100: '#ddfadd',
          300: '#7ee87e',
          400: '#4fd852',
          500: '#3cc63c',
          600: '#2ea830',
          700: '#248527',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
