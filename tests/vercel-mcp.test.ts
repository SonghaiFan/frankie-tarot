import assert from "node:assert/strict";
import { after, test } from "node:test";
import handler from "../plugins/chatgpt/dist/vercel-handler.mjs";

process.env.TAROT_SIGNING_KEY = "vercel-route-integration-test-key-32-characters";
after(() => { delete process.env.TAROT_SIGNING_KEY; });

async function post(message: unknown, origin = "https://chatgpt.com") {
  const response = await handler(new Request("https://tarot.songhai.site/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Origin: origin },
    body: JSON.stringify(message),
  }));
  return { response, body: await response.json() as any };
}

test("Vercel /mcp handles preflight and rejects untrusted browser origins", async () => {
  const preflight = await handler(new Request("https://tarot.songhai.site/mcp", {
    method: "OPTIONS", headers: { Origin: "https://chatgpt.com" },
  }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://chatgpt.com");

  const response = await handler(new Request("https://tarot.songhai.site/mcp", {
    method: "POST", headers: { Origin: "https://unrelated.invalid" }, body: "{}",
  }));
  assert.equal(response.status, 403);
});

test("Vercel /mcp exposes the original staged tarot tools and same-origin card art", async () => {
  const init = await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
    protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "vercel-test", version: "1" },
  } });
  assert.equal(init.response.status, 200);
  assert.equal(init.body.result.serverInfo.name, "frankie-tarot");

  const { body } = await post({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  assert.deepEqual(body.result.tools.map((tool: any) => tool.name).sort(), [
    "draw_tarot_cards", "list_tarot_spreads", "open_tarot", "reveal_tarot_cards", "show_tarot_result",
  ]);

  const open = await post({ jsonrpc: "2.0", id: 3, method: "tools/call", params: {
    name: "open_tarot", arguments: { question: "What should I consider?", spread: "THREE" },
  } });
  assert.equal(open.body.result.structuredContent.stage, "input");

  const draw = await post({ jsonrpc: "2.0", id: 4, method: "tools/call", params: {
    name: "draw_tarot_cards", arguments: { question: "What should I consider?", spread: "THREE" },
  } });
  const view = draw.body.result.structuredContent;
  assert.equal(view.stage, "picking");
  assert.equal(view.canInterpret, false);
  assert.deepEqual(view.cards, []);
  const privateReading = draw.body.result._meta.tarot.reading;
  assert.match(privateReading.cards[0].imageUrl, /^https:\/\/tarot\.songhai\.site\/assets\/redraw\//);
});
