/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#0d1117", 900: "#131a24", 800: "#1b2430", 700: "#2a3544" },
        accent: { DEFAULT: "#5eead4", dim: "#2dd4bf" },
      },
    },
  },
  plugins: [],
};
