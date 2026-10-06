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
  const storageKey = `f-tarot-preview:${location.pathname}${location.search}`;
  let widgetState: any;
  try { widgetState = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null'); } catch { /* Fresh preview. */ }
  let toolName = 'open_tarot';
  let initial = CallToolResultSchema.parse(await client.callTool({name:toolName,arguments:{locale,...(widgetState?.privateContent?.flowId ? {flowId:widgetState.privateContent.flowId} : params.has('question')?{question:params.get('question')}: {})}}));
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
    serverTools: {}, serverResources: {}, message: { text: {} }, updateModelContext: {}, downloadFile: {},
  }, { hostContext: { theme: "light", locale, displayMode: "inline", availableDisplayModes: ["inline", "fullscreen"] } });
  let latestContext: Record<string, any> = {};
  bridge.ondownloadfile = async ({contents}) => {
    const image=contents[0];
    if(image.type!=='resource' || !('blob' in image.resource)) return {isError:true};
    const link=document.createElement('a');
    link.href=`data:${image.resource.mimeType};base64,${image.resource.blob}`;
    link.download=image.resource.uri.split('/').pop()!;
    link.textContent=`Download ${link.download}`;
    const output=document.getElementById('preview-output')!;
    output.replaceChildren(link);
    const thumbnail=document.createElement('img');
    thumbnail.src=link.href;thumbnail.alt='Exported reading PNG';thumbnail.style.width='100%';
    output.append(thumbnail);
    return {};
  };
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
  for (const [id,args] of [
    ['preview-question',()=>({question:'我这周该注意什么',spread:'THREE',locale,flowId:latestContext.flowId})],
    ['preview-summary',()=>({locale,flowId:latestContext.flowId,summary:{readingId:latestContext.readingId,text:'风停在旧路的尽头，也替新的方向留下一盏灯。你不必立刻找到答案，先照亮脚下的一步。'}})],
    ['preview-resume',()=>({locale,flowId:latestContext.flowId})],
  ] as const) document.getElementById(id)!.onclick = async () => {
    const result = CallToolResultSchema.parse(await client.callTool({name:'open_tarot',arguments:args()}));
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
  // Mimic ChatGPT's private widget persistence without giving the opaque iframe browser storage.
  window.addEventListener('message',event=>{
    if (event.source !== iframe.contentWindow || event.data?.type !== 'tarot-preview-widget-state') return;
    widgetState=event.data.state;
    try { sessionStorage.setItem(storageKey,JSON.stringify(widgetState)); } catch { /* Storage may be unavailable. */ }
  });
  const seed=JSON.stringify(widgetState ?? null).replaceAll('<','\\u003c');
  const shim=`<script>window.openai={widgetState:${seed},setWidgetState(state){this.widgetState=state;parent.postMessage({type:'tarot-preview-widget-state',state},'*')}};<\/script>`;
  iframe.srcdoc = shim + html.text;
  document.getElementById("preview-theme")!.onclick = () => {
    const dark = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    bridge.setHostContext({ theme: dark ? "dark" : "light" });
  };
}

start().catch((error) => { status.textContent = `Connection failed: ${error.message}`; status.dataset.error = "true"; });
