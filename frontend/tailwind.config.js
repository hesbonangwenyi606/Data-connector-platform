/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: '#1e293b',
          hover: '#334155',
          active: '#3b82f6',
        },
      },
    },
  },
  plugins: [],
}
