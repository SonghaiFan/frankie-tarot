import { parseArgs } from "node:util";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const { values } = parseArgs({ options: { url: { type: "string" }, "app-id": { type: "string" } } });
if (!values.url) throw new Error("Usage: npm run plugin:configure -- --url https://your-server/mcp [--app-id plugin_asdk_app_…]");
const url = new URL(values.url);
if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search || url.pathname !== "/mcp") {
  throw new Error("Use the actual public HTTPS /mcp endpoint without credentials, query parameters or fragments.");
}
const appId = values["app-id"]?.replace(/^plugin_/, "");
if (appId && !/^asdk_app_[A-Za-z0-9_-]+$/.test(appId)) throw new Error("Use the real asdk_app_… or plugin_asdk_app_… ID shown after registration.");
const directory = fileURLToPath(new URL("./", import.meta.url));
const target = join(directory, "package");
const manifest = JSON.parse(await readFile(join(directory, "plugin.json"), "utf8"));
// Keep the verified account mapping in packages generated without an override.
const apps = appId
  ? { apps: { "frankie-tarot": { id: appId } } }
  : JSON.parse(await readFile(join(directory, ".app.json"), "utf8"));
manifest.extensions["com.openai"].apps = "./.app.json";
await mkdir(target, { recursive: true });
await writeFile(join(target, "plugin.json"), JSON.stringify(manifest, null, 2) + "\n");
await writeFile(join(target, "mcp.json"), JSON.stringify({
  $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  mcpServers: { "frankie-tarot": { type: "streamable-http", url: url.href } },
}, null, 2) + "\n");
await writeFile(join(target, ".app.json"), JSON.stringify(apps, null, 2) + "\n");
await mkdir(join(target, "assets"), { recursive: true });
await copyFile(join(directory, "assets/aura-logo.svg"), join(target, "assets/aura-logo.svg"));
await copyFile(join(directory, "assets/aura-logo.png"), join(target, "assets/aura-logo.png"));
await copyFile(join(directory, "README.md"), join(target, "README.md"));
console.log(`Generated the plugin package in ${target}`);
