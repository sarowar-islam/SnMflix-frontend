/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          background: '#07110F',
          surface: '#0D1915',
          card: '#12221D',
          hover: '#1A3027',
          emerald: '#10B981',
          mint: '#D1FAE5',
          sage: '#8BA69A',
        },
      },
    },
  },
  plugins: [],
};