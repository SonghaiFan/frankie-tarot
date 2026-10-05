import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, mkdir, copyFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { createTarotEngine, payloadSchema } from "./engine";
import { createTarotHttpServer, getUiUri } from "./server";

const widgetHtml = "<!doctype html><html><body>F.Tarot test resource</body></html>";
const UI_URI = getUiUri(widgetHtml);

const root = fileURLToPath(new URL("../../", import.meta.url));
const engine = createTarotEngine({ publicBaseUrl: "http://127.0.0.1:8787", signingKey: "integration-test-signing-key-32-characters" });
let directory: string;
let server: ReturnType<typeof createTarotHttpServer>;
let client: Client;
let baseUrl: string;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "tarot-mcp-test-"));
  await mkdir(join(directory, "redraw"));
  await copyFile(join(root, "public/images/cards/maj00.webp"), join(directory, "redraw/maj00.webp"));
  server = createTarotHttpServer({ engine, publicBaseUrl: "http://127.0.0.1:8787", assetDirectory: directory,
    widgetHtml });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
  client = new Client({ name: "tarot-integration-tests", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`)));
});

after(async () => {
  await client?.close();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("MCP discovery exposes the data tools, empty-argument launcher and both entrypoints", async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), ["draw_tarot_cards", "list_tarot_spreads", "open_tarot"]);
  for (const tool of tools) { assert.ok(tool.inputSchema); assert.ok(tool.outputSchema); assert.equal(tool.annotations?.readOnlyHint, true); }
  const launcher = tools.find((tool) => tool.name === "open_tarot")!;
  assert.equal((launcher._meta?.ui as any).resourceUri, UI_URI);
  assert.deepEqual((launcher._meta?.["openai/ui"] as any).entrypoints, [{ type: "global" }, { type: "thread" }]);
  assert.ok(!tools.find((tool) => tool.name === "draw_tarot_cards")?._meta?.ui);
  const result = await client.callTool({ name: "open_tarot", arguments: {} });
  const payload = payloadSchema.parse(result.structuredContent);
  assert.equal(payload.spreads.length, 11);
  assert.equal(payload.reading, undefined);
});

test("real HTTP draw → render preserves all cards and replay token", async () => {
  const drawn = CallToolResultSchema.parse(await client.callTool({ name: "draw_tarot_cards", arguments: {
    question: "What should I reflect on this week?", spread: "THREE", locale: "en", reversedProbability: 1,
  } }));
  assert.notEqual(drawn.isError, true);
  const payload = payloadSchema.parse(drawn.structuredContent);
  assert.equal(payload.reading!.cards.length, 3);
  assert.ok(payload.reading!.cards.every((card) => card.isReversed));
  const rendered = await client.callTool({ name: "open_tarot", arguments: { readingToken: payload.readingToken } });
  assert.deepEqual(payloadSchema.parse(rendered.structuredContent), payload);
});

test("protocol input validation rejects unknown spread and attempted custom cards", async () => {
  for (const input of [{ spread: "AUTO" }, { locale: "fr" }, { reversedProbability: 2 }, { customCards: [{ id: 0 }] }]) {
    const result = await client.callTool({ name: "draw_tarot_cards", arguments: input });
    assert.equal(result.isError, true);
  }
});

test("render reports invalid tokens without silently drawing replacement cards", async () => {
  const result = await client.callTool({ name: "open_tarot", arguments: { readingToken: "not-a-real-token" } });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
});

test("UI resource uses MCP Apps MIME, exact image CSP and no generated reading HTML", async () => {
  const result = await client.readResource({ uri: UI_URI });
  const resource = result.contents[0];
  assert.equal(resource.mimeType, "text/html;profile=mcp-app");
  assert.equal(resource.uri, UI_URI);
  assert.equal((resource._meta?.ui as any).prefersBorder, false);
  assert.deepEqual((resource._meta?.ui as any).csp, { connectDomains: ["http://127.0.0.1:8787"], resourceDomains: ["http://127.0.0.1:8787", "https://fonts.googleapis.com", "https://fonts.gstatic.com"] });
  assert.deepEqual((resource._meta?.["openai/ui"] as any).availableDisplayModes, ["fullscreen"]);
  assert.match((resource as any).text, /F.Tarot test resource/);
});

test("HTTP serves the actual canonical artwork and clean error responses", async () => {
  const asset = await fetch(`${baseUrl}/assets/redraw/maj00.webp`);
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get("content-type"), "image/webp");
  assert.deepEqual(Buffer.from(await asset.arrayBuffer()), await readFile(join(root, "public/images/cards/maj00.webp")));
  assert.equal((await fetch(`${baseUrl}/assets/redraw/not-a-card.webp`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/preview`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/mcp`)).status, 405);
  assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
});

test("MCP rejects unexpected browser origins and excessive request bodies", async () => {
  const unexpected = await fetch(`${baseUrl}/mcp`, { method: "POST", headers: { Origin: "https://unrelated.invalid", "Content-Type": "application/json" }, body: "{}" });
  assert.equal(unexpected.status, 403);
  const oversized = await fetch(`${baseUrl}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ payload: "x".repeat(130 * 1024) }) });
  assert.equal(oversized.status, 413);
});

 test("UI resource identity changes with UI content and is stable across restarts", () => {
  assert.equal(getUiUri(widgetHtml), UI_URI);
  assert.notEqual(getUiUri(widgetHtml + "<!-- updated -->"), UI_URI);
  assert.match(UI_URI, /^ui:\/\/frankie-tarot\/app-[0-9a-f]{20}\.html$/);
});
