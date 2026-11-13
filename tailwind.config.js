/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        thanksgiving: {
          orange: '#ea580c',
          amber: '#d97706',
          rust: '#9a3412',
          cranberry: '#be123c',
          sage: '#4d7c0f',
          warmBg: '#fefcf8',
        }
      }
    },
  },
  plugins: [],
}
