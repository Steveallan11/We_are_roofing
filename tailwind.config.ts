import type { Config } from "tailwindcss";
import animatePlugin from "tailwindcss-animate";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#D4AF37",
          light: "#E8CB5A",
          dim: "#B8960C",
          50: "rgba(212,175,55,0.05)",
          100: "rgba(212,175,55,0.10)",
          200: "rgba(212,175,55,0.20)"
        },
        obsidian: {
          DEFAULT: "#0a0a0a",
          50: "#0d0d0d",
          100: "#111111",
          200: "#161616",
          300: "#1a1a1a",
          400: "#1e1e1e",
          500: "#2a2a2a",
          600: "#333333",
          700: "#555555",
          800: "#888888",
          900: "#dddddd"
        },
        lead: "#3b82f6",
        survey: "#f59e0b",
        quoting: "#D4AF37",
        sent: "#8b5cf6",
        active: "#10b981",
        done: "#64748b",
        ink: "#0a0a0a",
        card: "#111111",
        card2: "#161616",
        "gold-light": "#E8CB5A",
        "gold-dark": "#B8960C"
      },
      fontFamily: {
        display: ["Playfair Display", "Georgia", "Times New Roman", "serif"],
        body: ["Cormorant Garamond", "Georgia", "Times New Roman", "serif"],
        ui: ["Montserrat", "Helvetica Neue", "Helvetica", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Courier New", "monospace"],
        sans: ["Montserrat", "Helvetica Neue", "Helvetica", "sans-serif"],
        condensed: ["Playfair Display", "Georgia", "Times New Roman", "serif"]
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
        xl: "12px",
        "2xl": "16px"
      },
      boxShadow: {
        sm: "0 1px 3px rgba(0,0,0,0.4)",
        DEFAULT: "0 4px 16px rgba(0,0,0,0.5)",
        lg: "0 8px 40px rgba(0,0,0,0.6)",
        gold: "0 0 20px rgba(212,175,55,0.12)",
        focus: "0 0 0 3px rgba(212,175,55,0.20)",
        card: "0 4px 16px rgba(0,0,0,0.5)"
      },
      animation: {
        "pulse-gold": "goldPulse 2.4s ease-in-out infinite",
        "slide-in": "slideIn 0.2s ease",
        "fade-in": "fadeIn 0.3s ease",
        shimmer: "shimmer 1.8s ease-in-out infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out"
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }
        }
      }
    }
  },
  plugins: [animatePlugin],
  safelist: [
    { pattern: /text-(lead|survey|quoting|sent|active|done|gold)/ },
    { pattern: /bg-(lead|survey|quoting|sent|active|done|gold)/ },
    { pattern: /border-(lead|survey|quoting|sent|active|done|gold)/ },
    { pattern: /bg-obsidian/ }
  ]
};

export default config;
