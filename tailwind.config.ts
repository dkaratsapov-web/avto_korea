import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./data/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        graphite: { DEFAULT: "#11151A", 2: "#1B222B", 3: "#232C36" },
        bordeaux: { DEFAULT: "#7A1410", deep: "#530700", bright: "#9C1A12" },
        steel: "#5C6D76",
        chrome: { DEFAULT: "#AEBAC2", lt: "#E6EAED", dark: "#33414B" },
        paper: "#F5F6F8",
        ink: { DEFAULT: "#171A1E", 2: "#5B6470" },
        line: { DEFAULT: "#E6E8EC", dark: "rgba(255,255,255,.09)" },
        success: "#2ECC71",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        num: ["var(--font-num)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        btn: "12px",
      },
      maxWidth: {
        container: "1240px",
      },
      boxShadow: {
        card: "0 22px 44px rgba(20,25,33,.14)",
        btn: "0 6px 18px rgba(122,20,16,.35)",
        chip: "0 18px 40px rgba(0,0,0,.4)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up .5s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
