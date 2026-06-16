/** @type {import('next').NextConfig} */

// Для превью на GitHub Pages собираем статический экспорт с basePath репозитория.
// Обычная сборка (Cloudflare Pages / Vercel / Node) остаётся без изменений.
const ghPages = process.env.GH_PAGES === "true";
const repo = "avto_korea";

const nextConfig = {
  reactStrictMode: true,
  ...(ghPages
    ? {
        output: "export",
        basePath: `/${repo}`,
        assetPrefix: `/${repo}/`,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
