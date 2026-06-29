import type { Config } from "tailwindcss";
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          bg:            "var(--bg)",
          warm:          "var(--warm)",
          card:          "var(--card)",
          border:        "var(--border)",
          "border-warm": "var(--accent)",
          text:          "var(--text)",
          muted:         "var(--muted)",
          "muted-light": "var(--muted-light)",
          orange:           "var(--accent)",
          "orange-light":   "var(--accent-light)",
          "orange-readable":"var(--accent-readable)",
          amber:            "var(--accent-2)",
          "footer-bg":   "var(--footer-bg)",
          tint:          "var(--tint)",
          "tint-border": "var(--tint-border)",
          surface:       "var(--surface)",
          hover:         "var(--hover)",
          "btn-fg":      "var(--btn-fg)",
        },
      },
      fontFamily: {
        display: ["var(--font-bebas)", "sans-serif"],
        body:    ["var(--font-poppins)", "sans-serif"],
      },
      backgroundImage: {
        "cta-gradient": "linear-gradient(135deg, var(--grad-a) 0%, var(--grad-b) 100%)",
      },
    },
  },
  plugins: [],
};
export default config;