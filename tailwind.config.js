/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pittsboro: {
          green: '#2d5a27',
          gold: '#c4a43c',
          dark: '#1a3a17',
        },
      },
    },
  },
  plugins: [],
}

