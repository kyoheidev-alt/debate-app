import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          600: "#2A3D52",
          700: "#1E2D3D",
          800: "#152537",
          900: "#0D1B2A",
        },
        gold: {
          400: "#D9BC6B",
          500: "#C9A84C",
        },
        ink: "#E8EEF4",
        muted: "#A8B5C4",
        pro: {
          DEFAULT: "#2563eb",
          light: "#dbeafe",
        },
        con: {
          DEFAULT: "#dc2626",
          light: "#fee2e2",
        },
        chair: {
          DEFAULT: "#7c3aed",
          light: "#ede9fe",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-noto-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Hiragino Sans",
          "Yu Gothic",
          "sans-serif",
        ],
        serif: [
          "var(--font-noto-serif)",
          "Noto Serif JP",
          "Hiragino Mincho ProN",
          "Yu Mincho",
          "serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
