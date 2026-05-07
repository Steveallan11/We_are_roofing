import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080808",
        slate: "#111111",
        mist: "#f8f4e8",
        steel: "#b7ab86",
        ember: "#d4af37",
        signal: "#f5d060",
        pine: "#2ecc71",
        crimson: "#e74c3c",
        gold: "#d4af37",
        "gold-light": "#f5d060",
        "gold-dark": "#8b6914",
        card: "#181818",
        card2: "#1f1f1f"
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        display: ["var(--font-display)"],
        condensed: ["var(--font-condensed)"],
        mono: ["var(--font-mono)"]
      },
      boxShadow: {
        card: "0 18px 45px rgba(15, 23, 32, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
