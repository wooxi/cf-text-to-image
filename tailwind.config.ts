import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "app-bg": "var(--bg-primary)",
        "app-bg2": "var(--bg-secondary)",
        "app-bg3": "var(--bg-tertiary)",
        "app-border": "var(--border)",
        "app-border-hover": "var(--border-hover)",
        "app-text": "var(--text-primary)",
        "app-text2": "var(--text-secondary)",
        "app-text3": "var(--text-muted)",
        "app-accent": "var(--accent)",
        "app-accent-hover": "var(--accent-hover)",
        "app-danger": "var(--danger)",
      },
    },
  },
  plugins: [],
};
export default config;
