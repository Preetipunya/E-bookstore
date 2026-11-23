/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0a0a0c', 900: '#101013', 800: '#17171b', 700: '#212127', 600: '#2d2d35', 500: '#3b3b45' },
        brand: { 400: '#6aa6ff', 500: '#2f7bff', 600: '#1d63e8', 700: '#164fc0' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '"Segoe UI"', 'Roboto', 'sans-serif'],
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
      },
      keyframes: {
        'toast-in': { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'pop-in': { '0%': { opacity: '0', transform: 'scale(0.6)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'toast-in': 'toast-in 0.25s ease-out',
        'fade-in': 'fade-in 0.35s ease-out',
        'pop-in': 'pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
};
