/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0a0c0f",
          900: "#12151a",
          800: "#1a1f27",
          700: "#2a3140",
        },
        signal: {
          DEFAULT: "#e8ff47",
          dim: "#b8cc2e",
        },
        coral: {
          DEFAULT: "#ff5c4d",
        },
      },
      fontFamily: {
        display: ['"Syne"', "system-ui", "sans-serif"],
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
