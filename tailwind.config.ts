import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080808",
        card: "#181818",
        card2: "#1f1f1f",
        gold: "#d4af37",
        "gold-light": "#f5d060",
        "gold-dark": "#8b6914",
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        condensed: ["var(--font-heading)"],
      },
      boxShadow: {
        card: "0 18px 45px rgba(15, 23, 32, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
