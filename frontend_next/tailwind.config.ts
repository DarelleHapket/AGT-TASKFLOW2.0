import type { Config } from "tailwindcss";

// Palette reprise de frontend/src/index.css (AGT TaskFlow) — même identité
// visuelle, mais exposée en tokens Tailwind pour bénéficier des variantes
// responsive (sm:/md:/lg:) par construction (cf. Document de Conception v1.1).
const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-card": "var(--bg-card)",
        "bg-hover": "var(--bg-hover)",
        "bg-input": "var(--bg-input)",
        border: "var(--border)",
        "border-2": "var(--border-2)",
        text: "var(--text)",
        "text-2": "var(--text-2)",
        "text-3": "var(--text-3)",
        accent: "var(--accent)",
        "accent-bg": "var(--accent-bg)",
        "accent-h": "var(--accent-h)",
        danger: "var(--danger)",
        "danger-bg": "var(--danger-bg)",
        success: "var(--success)",
        warning: "var(--warning)",
      },
      borderRadius: {
        DEFAULT: "10px",
        lg: "14px",
      },
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
