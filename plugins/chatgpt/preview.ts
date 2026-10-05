/** Local-only integration host. It exercises the real MCP server and MCP Apps bridge. */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";

const status = document.getElementById("preview-status")!;
const context = document.getElementById("preview-context")!;
const message = document.getElementById("preview-message")!;
const container = document.getElementById("preview-table")!;

async function start() {
  const locale = new URLSearchParams(location.search).get("locale") === "en" ? "en" : "zh-CN";
  const client = new Client({ name: "F.Tarot local preview", version: "0.1.0" }, {
    capabilities: { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } } },
  });
  await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", location.href)));
  const params = new URLSearchParams(location.search);
  let toolName = 'open_tarot';
  let initial = CallToolResultSchema.parse(await client.callTool({name:toolName,arguments:{locale,...(params.has('question')?{question:params.get('question')}: {})}}));
  if (params.has('result')) {
    toolName='draw_tarot_cards';
    const draw=CallToolResultSchema.parse(await client.callTool({name:toolName,arguments:{question:'我这周该注意什么',spread:'THREE',locale}}));
    const token=(draw.structuredContent as any).sessionToken;
    const reveal=await client.callTool({name:'reveal_tarot_cards',arguments:{sessionToken:token,positions:[1,2,3]}});
    initial=CallToolResultSchema.parse(await client.callTool({name:'show_tarot_result',arguments:{sessionToken:(reveal.structuredContent as any).sessionToken,interpretation:'本地交互验证：这段文字用于确认同一组牌显示在聊天结果卡中，不是模型生成的解读。',cardFaceStyle:'dreamy'}}));
    toolName='show_tarot_result';
  }
  const { tools } = await client.listTools();
  const uiUri = (tools.find(tool => tool.name === toolName)?._meta?.ui as {resourceUri?: string})?.resourceUri;
  if (!uiUri) throw new Error("Missing UI resource in tool discovery");
  const resource = await client.readResource({ uri: uiUri });
  const html = resource.contents.find((item) => "text" in item);
  if (!html || !("text" in html)) throw new Error("The MCP UI resource contains no HTML.");
  const iframe = document.createElement("iframe");
  iframe.id = "tarot-app";
  iframe.title = "F.Tarot MCP App";
  iframe.setAttribute("sandbox", "allow-scripts");
  container.append(iframe);
  const bridge = new AppBridge(client, { name: "F.Tarot local preview", version: "0.1.0" }, {
    serverTools: {}, serverResources: {}, message: { text: {} }, updateModelContext: {},
  }, { hostContext: { theme: "light", locale, displayMode: "inline", availableDisplayModes: ["inline", "fullscreen"] } });
  let latestContext: Record<string, any> = {};
  bridge.onupdatemodelcontext = async (params) => {
    latestContext = params.structuredContent ?? {};
    context.textContent = JSON.stringify(params, null, 2);
    (window as any).__tarotPreviewContext = params;
    return {};
  };
  bridge.onmessage = async (params) => {
    message.textContent = params.content.map((item) => "text" in item ? item.text : `[${item.type}]`).join("\n");
    (window as any).__tarotPreviewMessage = params;
    return {};
  };
  bridge.onrequestdisplaymode = async ({ mode }) => {
    const supported = mode === "fullscreen" ? "fullscreen" : "inline";
    container.classList.toggle("fullscreen", supported === "fullscreen");
    bridge.setHostContext({ displayMode: supported });
    return { mode: supported };
  };
  for (const [id,name,args] of [
    ['preview-reveal','reveal_tarot_cards',()=>({sessionToken:latestContext.sessionToken,positions:[1]})],
    ['preview-result','show_tarot_result',()=>({sessionToken:latestContext.sessionToken,interpretation:'本地交互验证：这段文字用于检查同一组牌与分享图文组件，不是模型生成的解读。'})],
    ['preview-question','open_tarot',()=>({question:'我这周该注意什么',spread:'THREE',locale})],
  ] as const) document.getElementById(id)!.onclick = async () => {
    const result = CallToolResultSchema.parse(await client.callTool({name,arguments:args()}));
    if (result.isError) {message.textContent=JSON.stringify(result.content);return;}
    await bridge.sendToolInput({arguments:args()});
    await bridge.sendToolResult(result);
  };
  iframe.style.height = "min(850px, 90vh)";
  bridge.oninitialized = () => {
    void bridge.sendToolInput({ arguments: { locale } });
    void bridge.sendToolResult(initial);
    status.textContent = "Connected · real MCP server and app bridge";
    status.dataset.connected = "true";
  };
  const transport = new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!);
  await bridge.connect(transport);
  iframe.srcdoc = html.text;
  document.getElementById("preview-theme")!.onclick = () => {
    const dark = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    bridge.setHostContext({ theme: dark ? "dark" : "light" });
  };
}

start().catch((error) => { status.textContent = `Connection failed: ${error.message}`; status.dataset.error = "true"; });
