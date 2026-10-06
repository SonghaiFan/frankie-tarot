# Frank Tarot MCP server

A platform-neutral MCP server with an MCP Apps card table. It is a host adapter inside the original Frank Tarot repository, not a second app. Platform listings and submission tooling live on their own branches (for example `chatgpt-plugin`).

- UI entry: `src/app/App.tsx` for both the website and MCP hosts.
- Components, animations, styles, translations and card artwork: existing `src/` and `public/`.
- Canonical card/spread data: `src/features/tarot/data/ground-truth.json`.
- `ui/index.tsx` connects MCP to the original App through `src/host/tarotHost.ts`.
- `mcp.ts` declares the tools and UI resource, shared by local and Vercel handlers.
- `engine.ts` adds server-side secure draws and signed recovery tokens over canonical data.
- UI resource URIs include a hash of the built HTML so a host cannot reuse a previous UI under the same identifier.

The host model supplies interpretation in the current conversation. Provider API keys are never included in the widget. Host-specific `_meta` hints (such as `openai/*`) are additive; hosts that do not understand them ignore them.

## Tools

| User action | Tool / stage |
| --- | --- |
| Mention the app with a question | `open_tarot(question, flowId?)` / input |
| Start shuffle and select | `draw_tarot_cards(flowId)` / picking; the model cannot see hidden cards |
| Flip cards | `reveal_tarot_cards(sessionToken)` / reveal or ready |
| Place a brief reading in the table | `show_tarot_result(sessionToken)` / result |
| List spreads | `list_tarot_spreads(locale)` |

## Local testing

```sh
npm ci
npm run mcp:dev
```

Open http://127.0.0.1:8787/preview. This uses an opaque sandbox and real MCP requests. Interpretation messages are captured in the preview, not sent to a model.

```sh
npm run typecheck
npm run mcp:test
npm run test:vercel
```

## Deployment

`npm run build:vercel` builds the website, builds the widget from the same `src/` components, and places its card artwork under the website's `/assets/` path. `PUBLIC_BASE_URL` overrides the default `https://tarot.songhai.site` media origin. The Vercel project serves both the website and the MCP endpoint at `/mcp`; `vercel.json` rewrites that path to `api/mcp.ts`.

Set `TAROT_SIGNING_KEY` (at least 32 characters) in the Vercel Production environment so signed readings survive serverless cold starts and deploys. Never commit it.
