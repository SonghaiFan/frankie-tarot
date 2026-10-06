import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createTarotHttpServer } from "./server";

const port = Number(process.env.PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer from 1 to 65535.");
const host = process.env.HOST || "127.0.0.1";
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${port}`;
const publicUrl = new URL(publicBaseUrl);
if (!["http:", "https:"].includes(publicUrl.protocol) || publicUrl.pathname !== "/" || publicUrl.search || publicUrl.hash || publicUrl.username || publicUrl.password) {
  throw new Error("PUBLIC_BASE_URL must be a plain HTTP(S) origin with no path or credentials.");
}
if (publicUrl.protocol !== "https:" && !["127.0.0.1", "localhost", "[::1]"].includes(publicUrl.hostname)) {
  throw new Error("Use HTTPS for a public PUBLIC_BASE_URL.");
}
const dist = new URL("./", import.meta.url);
const widgetHtml = await readFile(new URL("widget.html", dist), "utf8");
const previewEnabled = process.env.ENABLE_PREVIEW === "1" ||
  (process.env.ENABLE_PREVIEW !== "0" && publicUrl.protocol === "http:" && host === "127.0.0.1");
const preview = previewEnabled ? {
  html: await readFile(new URL("preview.html", dist), "utf8"),
  javascript: await readFile(new URL("preview.js", dist), "utf8"),
} : undefined;
const server = createTarotHttpServer({ widgetHtml, publicBaseUrl,
  assetDirectory: fileURLToPath(new URL("assets/", dist)), preview, uiDomain: process.env.TAROT_UI_DOMAIN });
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.listen(port, host, () => {
  console.log(`F.Tarot MCP: ${publicUrl.origin}/mcp`);
  if (preview) console.log(`Local UI preview: http://127.0.0.1:${port}/preview`);
});
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => server.close(() => process.exit(0)));
