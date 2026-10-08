import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  // Dynamic base path:
  // - Respect explicit BASE_PATH or VITE_BASE_PATH
  // - Defaults to "/frankie-tarot/" for GitHub Actions (GitHub Pages)
  // - Defaults to "/" for Vercel, Netlify, Cloudflare Pages, and local dev
  const isGitHubPages =
    Boolean(process.env.GITHUB_ACTIONS) &&
    !process.env.VERCEL &&
    !process.env.NETLIFY &&
    !process.env.CF_PAGES;

  const basePath =
    env.VITE_BASE_PATH ||
    env.BASE_PATH ||
    process.env.BASE_PATH ||
    (isGitHubPages ? "/frankie-tarot/" : "/");

  return {
    base: basePath,
    server: {
      port: 3000,
      host: "0.0.0.0",
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
