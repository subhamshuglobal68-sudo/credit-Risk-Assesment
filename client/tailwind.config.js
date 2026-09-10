/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#007c89',
          dark: '#006570',
          light: '#e6f4f5',
        },
        brandYellow: '#ffe01b',
        creaBg: '#f0efeb',
        creaText: '#1d1d1d',
        creaMuted: '#5c5c5c',
        creaBorder: '#d5d5d5',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
