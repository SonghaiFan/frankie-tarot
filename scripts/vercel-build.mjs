import { cp, mkdir, readdir, unlink } from "node:fs/promises";
import { build as bundle } from "esbuild";
import { execFileSync } from "node:child_process";

execFileSync("npm", ["run", "plugin:build"], {
  stdio: "inherit",
  env: { ...process.env, PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || "https://tarot.songhai.site" },
});
execFileSync("npm", ["run", "build"], { stdio: "inherit" });

// The app loads card artwork as WebP. Keep source PNGs in the repository, but
// leave them out of Vercel's deployment output. The OG teaser PNG is retained.
for (const directory of [
  "cards",
  "images/cards",
  "images/cards_dreamy",
  "images/cards_rws_original",
]) {
  const cardDirectory = new URL(`../dist/${directory}/`, import.meta.url);
  for (const file of await readdir(cardDirectory)) {
    if (file.toLowerCase().endsWith(".png")) {
      await unlink(new URL(file, cardDirectory));
    }
  }
}
console.log("Excluded card PNGs from the Vercel output; retained WebP and the OG teaser.");

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
