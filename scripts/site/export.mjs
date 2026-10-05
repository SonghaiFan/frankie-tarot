import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const root=fileURLToPath(new URL("../../",import.meta.url));
const destination=resolve(process.argv[2] || ".");
if(destination===resolve(root)) throw new Error("Export must target the existing hosting checkout");
const manifest=JSON.parse(await readFile(join(root,".openai/hosting.json"),"utf8"));
const target=JSON.parse(await readFile(join(destination,".openai/hosting.json"),"utf8"));
if(target.project_id!==manifest.project_id) throw new Error("Site identity mismatch");
// Replace the previous committed deployment source; its history remains recoverable in Git.
const files=execFileSync("git",["ls-files","-z"],{cwd:destination,encoding:"utf8"}).split("\0").filter(Boolean);
for(const file of files) await rm(join(destination,file),{force:true});
await rm(join(destination,"dist"),{recursive:true,force:true});
const excluded=new Set([".git","node_modules",".env",".env.local",".sites-runtime",".DS_Store",".codex",".agents",".vercel"]);
async function copy(from,to){
 await mkdir(to,{recursive:true});
 for(const entry of await readdir(from,{withFileTypes:true})) {
  if(excluded.has(entry.name)||entry.name.startsWith(".env")||entry.name==="package"&&from.endsWith("chatgpt")) continue;
  if(from.startsWith(join(root,"public")) && entry.isFile() && !/\.(webp|svg|mp3|ico|json|txt)$/.test(entry.name)) continue;
  const source=join(from,entry.name),dest=join(to,entry.name);
  if(entry.isDirectory()) await copy(source,dest);
  else if(entry.isFile()) await cp(source,dest);
 }
}
await copy(root,destination);
await cp(join(root,"dist/client/audio/background.mp3"),join(destination,"public/audio/background.mp3"));
await writeFile(join(destination,"GENERATED_SOURCE.md"),"Generated from SonghaiFan/frankie-tarot. Do not maintain or edit this mirror independently. Rebuild and export from the canonical repository.\n");
console.log("Exported original Frank Tarot source and build to the existing Site checkout.");
