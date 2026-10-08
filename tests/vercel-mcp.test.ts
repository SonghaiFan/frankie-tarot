import assert from "node:assert/strict";
import { test } from "node:test";
import { createVercelHandler } from "../mcp/dist/vercel-handler.mjs";

// The endpoint must work even if a developer shell happens to have the old key.
delete process.env.TAROT_SIGNING_KEY;
const ids = ['SINGLE','THREE','COURT','FOUR','FIVE','TIMELINE','DIMENSION','CELTIC','RELATION','GOALS','YEARLY'];
const counts = [1,3,3,4,5,5,5,10,11,7,15];
const handler = createVercelHandler(async(name: string,args: Record<string,unknown>) => name === 'list_tarot_spreads'
  ? {locale:args.locale,spreads:ids.map((id,index)=>({id,name:`${id} spread`,description:'Fixture',cardCount:counts[index],labels:Array.from({length:counts[index]},(_,position)=>`Position ${position+1}`)}))}
  : {question:args.question,locale:args.locale,spread:{id:'THREE',cardCount:3},cards:[],sourceReadingId:'test-reading',policy:'reflection'});


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

test("Vercel /mcp works without a signing key and exposes the three adapter tools", async () => {
  const init = await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
    protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "vercel-test", version: "1" },
  } });
  assert.equal(init.response.status, 200);
  assert.equal(init.body.result.serverInfo.name, "frankie-tarot");

  const { body } = await post({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  assert.deepEqual(body.result.tools.map((tool: any) => tool.name).sort(), ['get_tarot_reading_context','list_tarot_spreads','open_tarot']);
  const open = await post({ jsonrpc:'2.0',id:3,method:'tools/call',params:{
    name:'open_tarot',arguments:{question:'What should I consider?',spread:'THREE'},
  }});
  assert.equal(open.body.result.structuredContent.question,'What should I consider?');
  assert.equal(open.body.result._meta.tarot.stage,'input');
  assert.equal(open.body.result._meta.tarot.reading,undefined);
  assert.equal(open.body.result.structuredContent.revealed,undefined);
  for (const name of ['draw_tarot_cards','reveal_tarot_cards','show_tarot_result']) {
    const removed=await post({jsonrpc:'2.0',id:4,method:'tools/call',params:{name,arguments:{}}});
    assert.equal(removed.body.result.isError,true);
  }
});
