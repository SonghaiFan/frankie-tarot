import { build as bundle } from "esbuild";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { mkdir, writeFile, copyFile, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const directory = fileURLToPath(new URL("./", import.meta.url));
const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(directory, "dist");
await mkdir(output, { recursive: true });
const origin = process.env.PUBLIC_BASE_URL || "http://127.0.0.1:8787";
const base = new URL(process.env.TAROT_ASSET_BASE_URL || `${origin}/`);
if (!base.pathname.endsWith("/") || base.search || base.hash || base.username || base.password) throw new Error("Use a plain asset origin");
const result = await build({
  configFile: false, root, base: base.href, publicDir: false,
  define: { "import.meta.env.VITE_TAROT_API_URL": JSON.stringify(process.env.VITE_TAROT_API_URL || "") },
  plugins: [react(), tailwindcss()],
  resolve: { alias: [
    { find: "@", replacement: join(root, "src") },
  ] },
  build: { write: false, cssCodeSplit: false, sourcemap: false,
    rollupOptions: { input: join(directory, "ui/index.tsx"), output: { format: "iife", inlineDynamicImports: true } },
  },
});
const files = result.output;
const js = files.filter(f => f.type === "chunk").map(f => f.code).join("\n");
const css = files.filter(f => f.type === "asset" && f.fileName.endsWith(".css")).map(f => f.source).join("\n");
await writeFile(join(output, "widget.html"), `<!doctype html><html lang="zh-CN" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Frank Tarot</title><link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;800&family=Noto+Serif+SC:wght@200;400;600&display=swap" rel="stylesheet"><style>${css.replace(/<\/style/gi, "<\\/style")}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`);
const server = await bundle({entryPoints:[join(directory,"main.ts")],bundle:true,outfile:join(output,"server.mjs"),platform:"node",format:"esm",target:"node22",packages:"external",metafile:true});
await bundle({entryPoints:[join(directory,"preview.ts")],bundle:true,outfile:join(output,"preview.js"),platform:"browser",format:"iife",target:"es2022",minify:true});
await copyFile(join(directory,"preview.html"),join(output,"preview.html"));
for (const [style, source] of [["redraw","cards"],["original","cards_rws_original"],["dreamy","cards_dreamy"]]) {
  const target=join(output,"assets",style); await mkdir(target,{recursive:true});
  const sourcePath=join(root,"public/images",source);
  const images=(await readdir(sourcePath)).filter(f=>/^[a-zA-Z0-9_-]+\.webp$/.test(f));
  if(images.length!==78) throw new Error(`Expected 78 ${style} assets`);
  await Promise.all(images.map(f=>copyFile(join(sourcePath,f),join(target,f))));
}
await rm(join(output,"audio"),{recursive:true,force:true});
await mkdir(join(output,"audio"),{recursive:true});
for(const f of await readdir(join(root,"public/audio"))) if(f.endsWith(".mp3")) await copyFile(join(root,"public/audio",f),join(output,"audio",f));
await mkdir(join(output,"card-backs"),{recursive:true});
for(const f of await readdir(join(root,"public/images/card-backs"))) if(f.endsWith(".svg")) await copyFile(join(root,"public/images/card-backs",f),join(output,"card-backs",f));
const modules=files.filter(f=>f.type==='chunk').flatMap(f=>Object.keys(f.modules));
await writeFile(join(output,"build-info.json"),JSON.stringify({sourceEntry:"src/app/App.tsx",assetOrigin:base.href,sourceInputs:modules,widgetBytes:Buffer.byteLength(js)+Buffer.byteLength(css)},null,2));
console.log("Built plugin from the original App, shared components, styles, data and artwork.");
