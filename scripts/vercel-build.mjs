import { cp, mkdir } from "node:fs/promises";
import { build as bundle } from "esbuild";
import { execFileSync } from "node:child_process";

execFileSync("npm", ["run", "plugin:build"], {
  stdio: "inherit",
  env: { ...process.env, PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || "https://tarot.songhai.site" },
});
execFileSync("npm", ["run", "build"], { stdio: "inherit" });

// The original site and its ChatGPT widget share the same public card files.
const source = new URL("../plugins/chatgpt/dist/assets/", import.meta.url);
const target = new URL("../dist/assets/", import.meta.url);
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });
console.log("Vercel build includes the ChatGPT widget's card assets at /assets/.");

// Bundle local imports and JSON so Vercel runs the same implementation in native ESM.
await bundle({
  entryPoints: ["plugins/chatgpt/vercel-handler.ts"],
  outfile: "plugins/chatgpt/dist/vercel-handler.mjs",
  bundle: true, platform: "node", format: "esm", target: "node22", packages: "external",
});
