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
          // Dark palette (default)
          background: '#07110F',
          surface: '#0D1915',
          card: '#12221D',
          hover: '#1A3027',
          emerald: '#10B981',
          mint: '#D1FAE5',
          sage: '#8BA69A',

          // Light palette
          'light-bg': '#F5F8F6',
          'light-surface': '#FFFFFF',
          'light-card': '#FAFAFA',
          'text': '#F1F5F9', // light text for dark mode
          'light-text': '#0F172A', // dark text for light mode
        },
      },
    },
  },
  plugins: [],
};