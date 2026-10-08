import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, mkdir, copyFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createTarotHttpServer, getUiUri } from "./server";

const widgetHtml = "<!doctype html><html><body>F.Tarot test resource</body></html>";
const UI_URI = getUiUri(widgetHtml);
const spreadIds = ['SINGLE','THREE','COURT','FOUR','FIVE','TIMELINE','DIMENSION','CELTIC','RELATION','GOALS','YEARLY'];
const spreadCounts = [1,3,3,4,5,5,5,10,11,7,15];
const coreTool = async (name: string, args: Record<string, unknown>) => {
  if (name === 'list_tarot_spreads') return { locale: args.locale, spreads: spreadIds.map((id,index) => ({
    id, name: `${id} spread`, description: `Fixture for ${id}`, cardCount: spreadCounts[index],
    labels: Array.from({length:spreadCounts[index]},(_,position)=>`Position ${position+1}`),
    cardPools: Array.from({length:spreadCounts[index]},()=>"FULL"), interpretationInstruction: "Fixture",
  })) };
  return { question: args.question, locale: args.locale, spread: { id: 'THREE', cardCount: 3 }, cards: [], sourceReadingId: 'test-reading', policy: 'reflection' };
};

const root = fileURLToPath(new URL("../", import.meta.url));
let directory: string;
let server: ReturnType<typeof createTarotHttpServer>;
let client: Client;
let baseUrl: string;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "tarot-mcp-test-"));
  await mkdir(join(directory, "redraw"));
  await copyFile(join(root, "public/images/cards/maj00.webp"), join(directory, "redraw/maj00.webp"));
  server = createTarotHttpServer({ publicBaseUrl: "http://127.0.0.1:8787", assetDirectory: directory,
    widgetHtml, coreTool });
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

test("MCP discovery exposes the launcher and API-backed context tools", async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool=>tool.name).sort(), ['get_tarot_reading_context','list_tarot_spreads','open_tarot']);
  const launcher = tools.find(tool=>tool.name==='open_tarot')!;
  assert.equal((launcher._meta?.ui as any).resourceUri, UI_URI);
  assert.deepEqual(Object.keys(launcher.inputSchema.properties ?? {}).sort(),['flowId','locale','question','spread','summary']);
  assert.equal(launcher._meta?.['openai/ui'],undefined,'tool result is the only interaction entrypoint');
  const opened=await client.callTool({name:'open_tarot',arguments:{}});
  assert.equal((opened.structuredContent as any).spreads.length,11);
  assert.equal((opened._meta as any).tarot.stage,'intro');
  const spreads=await client.callTool({name:'list_tarot_spreads',arguments:{locale:'en'}});
  assert.ok((spreads.structuredContent as any).spreads.every((s:any)=>s.labels.length===s.cardCount));
  assert.ok(!(spreads.structuredContent as any).spreads.some((s:any)=>s.id==='AUTO'));
});

test("opening prefills without drawing and keeps reveal progress private", async () => {
  const question='  This week?  ';
  const setup=await client.callTool({name:'open_tarot',arguments:{question,spread:'THREE'}});
  const state=setup.structuredContent as any;
  assert.equal(state.question,question);
  assert.equal(state.spread,'THREE');
  assert.equal((setup._meta as any).tarot.stage,'input');
  assert.equal((setup._meta as any).tarot.reading,undefined);
  for (const field of ['cards','revealed','nextReveal','revealOrder','stage','sessionToken','canInterpret','interpretationPrompt']) {
    assert.equal(state[field],undefined,field+' is UI-only');
  }
  const flowId=state.flowId;
  const resumed=await client.callTool({name:'open_tarot',arguments:{flowId}});
  assert.equal((resumed.structuredContent as any).flowId,flowId);
  assert.equal((resumed._meta as any).tarot.question,undefined,'no new question requests UI recovery');
  assert.equal((resumed._meta as any).tarot.restoreRequested,true);
  assert.equal(resumed._meta?.['openai/widgetSessionId'],flowId);
  const next=await client.callTool({name:'open_tarot',arguments:{question:'New question',spread:'SINGLE',flowId}});
  assert.equal((next.structuredContent as any).flowId,flowId);
  assert.equal((next._meta as any).tarot.reading,undefined);
  for (const name of ['draw_tarot_cards','reveal_tarot_cards','show_tarot_result']) {
    assert.equal((await client.callTool({name,arguments:{}})).isError,true,'removed tool must be unavailable');
  }
});

test("launcher rejects invalid setup and removed legacy token inputs", async () => {
  for (const args of [{spread:'AUTO'},{locale:'fr'},{flowId:'invalid'},{readingToken:'not-a-real-token'},{sessionToken:'invalid'},{customCards:[{id:0}]}]) {
    const result=await client.callTool({name:'open_tarot',arguments:args});
    assert.equal(result.isError,true);
    assert.equal(result.structuredContent,undefined);
  }
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

test("cached launch descriptors remain readable after a UI deployment", async () => {
  const oldUri = getUiUri("previous deployment");
  assert.notEqual(oldUri, UI_URI);
  const current = (await client.readResource({ uri: UI_URI })).contents[0];
  const alias = (await client.readResource({ uri: oldUri })).contents[0];
  assert.deepEqual(alias, { ...current, uri: oldUri });
  await assert.rejects(client.readResource({ uri: "ui://frankie-tarot/app-invalid.html" }));
  await assert.rejects(client.readResource({ uri: "ui://other-app/app-01234567890123456789.html" }));
  const opened = await client.callTool({ name: "open_tarot", arguments: {} });
  assert.match((opened.content as any)[0].text, /does not confirm.*successfully rendered/);
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

test('brief summary writeback accepts service IDs and legacy UUIDs only for an existing flow', async () => {
  const flowId='b4267470-4910-43ad-a2ef-20f29efec10f', readingId='8cc59a71b4fb4cdbabf86930';
  const summary={readingId,text:'风穿过旧门，新的光从缝隙里来。'};
  const result=await client.callTool({name:'open_tarot',arguments:{flowId,summary}});
  assert.ok(!result.isError);
  assert.deepEqual((result._meta as any).tarot.summary,summary);
  assert.equal((result._meta as any).tarot.question,undefined);
  assert.equal((result.structuredContent as any).cards,undefined);
  const legacy = await client.callTool({name:'open_tarot',arguments:{flowId,summary:{readingId:'8cc59a71-b4fb-4cdb-abf8-6930e45d37ba',text:'A legacy reading remains intact.'}}});
  assert.ok(!legacy.isError);
  for (const args of [{summary},{flowId,summary,question:'new draw'},{flowId,summary,spread:'SINGLE'},{flowId,summary:{...summary,text:' '}}]) {
    assert.equal((await client.callTool({name:'open_tarot',arguments:args})).isError,true);
  }
});
