import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
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
        container: "1400px",
      },
      boxShadow: {
        card: "0 22px 44px rgba(20,25,33,.14)",
        btn: "0 6px 18px rgba(122,20,16,.35)",
        chip: "0 18px 40px rgba(0,0,0,.4)",
        glow: "0 0 0 1px rgba(174,186,194,.12), 0 30px 60px -20px rgba(0,0,0,.6)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-100%)" },
        },
        shine: {
          "0%": { backgroundPosition: "200% center" },
          "100%": { backgroundPosition: "-200% center" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "glow-pan": {
          "0%,100%": { transform: "translate(-8%, -4%) scale(1)", opacity: ".55" },
          "50%": { transform: "translate(8%, 6%) scale(1.15)", opacity: ".85" },
        },
        "scroll-cue": {
          "0%": { transform: "translateY(0)", opacity: "0" },
          "40%": { opacity: "1" },
          "80%,100%": { transform: "translateY(14px)", opacity: "0" },
        },
        nudge: {
          "0%,100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(6px)" },
        },
        "pulse-glow": {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(156,26,18,.55)" },
          "50%": { boxShadow: "0 0 0 9px rgba(156,26,18,0)" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up .5s ease both",
        marquee: "marquee var(--marquee-duration, 28s) linear infinite",
        shine: "shine 6s linear infinite",
        float: "float 6s ease-in-out infinite",
        "glow-pan": "glow-pan 14s ease-in-out infinite",
        "scroll-cue": "scroll-cue 1.8s ease-in-out infinite",
        nudge: "nudge 1.3s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "spin-slow": "spin-slow 22s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
