/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Manrope', 'sans-serif'] },
      colors: {
        cream: '#FAF8F5',
        terracotta: '#E07A5F',
        charcoal: '#2D2A26',
        taupe: '#7A746C',
        line: '#EFECE6'
      },
      boxShadow: {
        soft: '0 12px 40px rgba(45, 42, 38, .06)'
      }
    }
  },
  plugins: []
}
