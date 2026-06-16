import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// base задаётся для деплоя под подпапкой (GitHub Pages — /avto_korea/).
// На корневом домене (Vercel/Cloudflare/свой хостинг) — '/'.
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
