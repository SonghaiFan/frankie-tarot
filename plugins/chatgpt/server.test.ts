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
  assert.deepEqual(tools.map((tool) => tool.name).sort(), ["draw_tarot_cards", "list_tarot_spreads", "open_tarot", "reveal_tarot_cards", "show_tarot_result"]);
  for (const tool of tools) { assert.ok(tool.inputSchema); assert.ok(tool.outputSchema); assert.equal(tool.annotations?.readOnlyHint, true); }
  const launcher = tools.find((tool) => tool.name === "open_tarot")!;
  assert.equal((launcher._meta?.ui as any).resourceUri, UI_URI);
  assert.deepEqual((launcher._meta?.["openai/ui"] as any).entrypoints, [{ type: "global" }, { type: "thread" }]);
  assert.equal((tools.find((tool) => tool.name === "draw_tarot_cards")?._meta?.ui as any).resourceUri, UI_URI);
  const result = await client.callTool({ name: "open_tarot", arguments: {} });
  const payload = payloadSchema.parse(result.structuredContent);
  assert.equal(payload.spreads.length, 11);
  assert.equal(payload.reading, undefined);
});

test("HTTP stages conceal cards, preserve identities and gate result until every flip", async () => {
  const setup = await client.callTool({name:"open_tarot",arguments:{question:"This week?",spread:"THREE"}});
  assert.equal((setup.structuredContent as any).stage,"input");
  assert.equal((setup.structuredContent as any).question,"This week?");
  assert.deepEqual((setup.structuredContent as any).cards,[]);
  const drawn = CallToolResultSchema.parse(await client.callTool({name:"draw_tarot_cards",arguments:{question:"This week?",spread:"THREE",locale:"en",reversedProbability:1}}));
  const state = drawn.structuredContent as any;
  const privateDraw = (drawn._meta as any).tarot;
  assert.equal(state.stage,"picking"); assert.equal(state.canInterpret,false);
  assert.deepEqual(state.cards,[]); assert.equal(state.readingToken,undefined);
  assert.ok(privateDraw.reading.cards.every((c:any)=>c.isReversed));
  assert.ok(!JSON.stringify([state,drawn.content]).includes(privateDraw.reading.cards[0].name));
  let token=state.sessionToken;
  const early = await client.callTool({name:"show_tarot_result",arguments:{sessionToken:token,interpretation:"Premature interpretation"}});
  assert.equal(early.isError,true);
  const partial = await client.callTool({name:"reveal_tarot_cards",arguments:{sessionToken:token,positions:[2]}});
  token=(partial.structuredContent as any).sessionToken;
  assert.deepEqual((partial.structuredContent as any).cards.map((c:any)=>c.position),[2]);
  assert.equal((partial.structuredContent as any).canInterpret,false);
  const restored=await client.callTool({name:"open_tarot",arguments:{sessionToken:token}});
  assert.deepEqual((restored.structuredContent as any).revealed,[2]);
  assert.equal(((restored._meta as any).tarot.reading.id),privateDraw.reading.id);
  assert.equal((await client.callTool({name:"reveal_tarot_cards",arguments:{sessionToken:token,positions:[4]}})).isError,true);
  const ready=await client.callTool({name:"reveal_tarot_cards",arguments:{sessionToken:token,positions:[1,3]}});
  token=(ready.structuredContent as any).sessionToken;
  assert.equal((ready.structuredContent as any).canInterpret,true);
  const result=await client.callTool({name:"show_tarot_result",arguments:{sessionToken:token,interpretation:"Reflection, not prediction."}});
  assert.deepEqual((result.structuredContent as any).cards,privateDraw.reading.cards);
  assert.equal((result.structuredContent as any).view,"result");
  assert.equal((result.structuredContent as any).interpretation,"Reflection, not prediction.");
  const saved=await client.callTool({name:"show_tarot_result",arguments:{sessionToken:token,cardFaceStyle:"original"}});
  assert.equal(saved.isError,undefined);
  assert.equal((saved.structuredContent as any).interpretation,undefined,'saving cards alone must not synthesize an interpretation');
  assert.deepEqual((saved.structuredContent as any).cards,privateDraw.reading.cards);
  assert.equal((saved._meta as any).tarot.cardFaceStyle,"original");
  assert.equal((saved.structuredContent as any).cardFaceStyle,"original");
  assert.match((saved.content as any)[0].text,/Do not add an interpretation unless explicitly requested/);
  assert.equal((await client.callTool({name:"show_tarot_result",arguments:{sessionToken:state.sessionToken}})).isError,true,'old concealed snapshot must not become interpretable');
  const {tools}=await client.listTools();
  const uri=(tools.find(t=>t.name==='show_tarot_result')!._meta!.ui as any).resourceUri;
  const resource=(await client.readResource({uri})).contents[0];
  assert.equal((resource._meta?.['openai/ui'] as any).preferredDisplayMode,'inline');
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
  assert.equal((resource._meta?.["openai/ui"] as any).preferredDisplayMode, "inline");
  assert.deepEqual((resource._meta?.["openai/ui"] as any).availableDisplayModes, ["inline", "fullscreen"]);
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
