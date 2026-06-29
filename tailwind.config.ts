import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config = {
  content: [
    "./popup.html",
    "./css-editor.html",
    "./font-manager.html",
    "./settings.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Karla", "system-ui", "sans-serif"],
        display: ["'IM Fell English'", "serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        fabric: "0 3px 6px rgba(68,42,22,.08), 0 8px 24px rgba(68,42,22,.12)",
        "fabric-raised":
          "0 8px 16px rgba(68,42,22,.14), 0 16px 40px rgba(68,42,22,.18)",
        "fabric-pressed": "inset 0 2px 4px rgba(0,0,0,.18)",
        "fabric-button":
          "0 2px 4px rgba(68,42,22,.18), inset 0 1px 0 rgba(255,255,255,.12)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;

export default config;
