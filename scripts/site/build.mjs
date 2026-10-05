import { build as viteBuild } from "vite";
import { build as bundle } from "esbuild";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cp, mkdir, readdir, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const root=fileURLToPath(new URL("../../",import.meta.url));
process.chdir(root);
const origin=process.env.PUBLIC_BASE_URL;
if(!origin) throw new Error("Set PUBLIC_BASE_URL to the existing Site origin");
await rm(join(root,"dist"),{recursive:true,force:true});
// Both targets import the same original src/app/App.tsx and canonical data.
execFileSync(process.execPath,["plugins/chatgpt/build.mjs"],{stdio:"inherit",env:process.env});
await bundle({entryPoints:["scripts/site/sites-vite-plugin.ts"],bundle:true,platform:"node",format:"esm",packages:"external",outfile:"node_modules/.cache/tarot-sites-plugin.mjs"});
const {sites}=await import(new URL("../../node_modules/.cache/tarot-sites-plugin.mjs",import.meta.url));
await viteBuild({configFile:false,root,base:"/",publicDir:false,plugins:[react(),tailwindcss(),sites({mockAuth:false})],
 resolve:{alias:{"@":resolve(root,"src")}},define:{"process.env.API_KEY":'""',"process.env.GEMINI_API_KEY":'""'},
 build:{outDir:"dist/client",emptyOutDir:true}});
// Copy only served assets; PNG masters remain in the source repository.
async function copyAssets(from,to) {
 await mkdir(to,{recursive:true});
 for(const entry of await readdir(from,{withFileTypes:true})) {
  if(entry.name.startsWith('.')) continue;
  if(entry.isDirectory()) await copyAssets(join(from,entry.name),join(to,entry.name));
  else if(/\.(webp|svg|mp3|ico|json|txt)$/.test(entry.name)) await cp(join(from,entry.name),join(to,entry.name));
 }
}
await copyAssets(join(root,"public"),join(root,"dist/client"));
// Keep the original 30-minute soundtrack; emit a compact web delivery file.
execFileSync("ffmpeg",["-v","error","-y","-i","public/audio/background.mp3","-ac","1","-b:a","32k","dist/client/audio/background.mp3"],{stdio:"inherit"});
await cp("plugins/chatgpt/dist/assets","dist/client/assets",{recursive:true});
await mkdir("dist/server",{recursive:true});
await bundle({entryPoints:["plugins/chatgpt/worker.ts"],bundle:true,platform:"node",format:"esm",target:"es2022",outfile:"dist/server/index.js",loader:{".html":"text"},external:["node:*"],minify:true});
await writeFile("dist/server/wrangler.json",JSON.stringify({name:"frank-tarot",main:"index.js",compatibility_date:"2026-05-15",compatibility_flags:["nodejs_compat"],no_bundle:true,assets:{directory:"../client",binding:"ASSETS"}},null,2));
await mkdir("dist/.openai",{recursive:true});await cp(".openai/hosting.json","dist/.openai/hosting.json");
console.log("Built website and MCP Worker from one Frank Tarot source tree.");
