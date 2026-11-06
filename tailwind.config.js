/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lora', 'Georgia', 'ui-serif', 'serif'],
        display: ['"Cormorant Garamond"', 'Georgia', 'ui-serif', 'serif'],
        ui: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f4f6f2', 100: '#e5e9df', 200: '#c8d1bc',
          300: '#a4b494', 400: '#7e9470', 500: '#5e7852',
          600: '#4a6040', 700: '#3b4d32', 800: '#2e3c26',
          900: '#1f2919', 950: '#111708',
        },
        sage: {
          50: '#f7f7ef', 100: '#eeeed9', 200: '#dcddb7',
          300: '#c5c68e', 400: '#b4b580', 500: '#a3a676',
          600: '#8a8d5d', 700: '#6e7149', 800: '#545637',
          900: '#363820', 950: '#1a1b0e',
        },
        cream: {
          50: '#fdfdf8', 100: '#f9f8ee', 200: '#f2f0dc',
          300: '#e8e5c4', 400: '#d8d4a4', 500: '#c4be80',
        },
        ink: {
          50: '#f5f4ee', 100: '#eae8dc', 200: '#d0ccb8',
          300: '#b0aa90', 400: '#8c8568', 500: '#6e674e',
          600: '#555039', 700: '#403c29', 800: '#2c2a1c',
          900: '#1a190e', 950: '#0e0d07',
        },
      },
      boxShadow: {
        xs:      '0 1px 2px 0 rgb(60 55 30 / 0.05)',
        card:    '0 1px 3px 0 rgb(60 55 30 / 0.06), 0 1px 2px -1px rgb(60 55 30 / 0.04)',
        raised:  '0 4px 8px -2px rgb(60 55 30 / 0.08), 0 2px 4px -2px rgb(60 55 30 / 0.05)',
        overlay: '0 20px 40px -8px rgb(40 35 15 / 0.18), 0 8px 16px -4px rgb(40 35 15 / 0.10)',
        kpi:     '0 2px 8px -2px rgb(100 90 40 / 0.10)',
      },
      borderRadius: { xl: '0.75rem', '2xl': '1rem' },
      keyframes: {
        'fade-in':  { from: { opacity: '0' },      to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.985)' },
          to:   { opacity: '1', transform: 'translateY(0)   scale(1)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in':  'fade-in 0.15s ease-out',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.16,1,0.3,1)',
        shimmer:    'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
