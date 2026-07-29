/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "hsl(222 47% 4%)",
        card: "hsl(222 40% 8%)",
        border: "hsl(222 30% 18%)",
        muted: "hsl(222 20% 60%)",
        accent: "hsl(190 95% 55%)",
        fg: "hsl(210 40% 98%)",
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui"] },
    },
  },
  plugins: [],
};