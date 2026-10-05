# Frank Tarot in ChatGPT

This is a host adapter inside the original Frank Tarot repository, not a second app.

- UI entry: `src/app/App.tsx` for both the website and ChatGPT.
- Components, animations, styles, translations and card artwork: existing `src/` and `public/`.
- Canonical card/spread data: `src/features/tarot/data/ground-truth.json`.
- `ui/index.tsx` connects MCP to the original App through `src/host/tarotHost.ts`.
- UI resource URIs include a hash of the built HTML so a host cannot reuse a previous UI under the same identifier. The preview discovers the URI from tool metadata.
- `mcp.ts` declares the tools and UI resource, shared by local and Vercel handlers.
- `engine.ts` adds server-side secure draws and signed recovery tokens over canonical data.

The ChatGPT host supplies interpretation in the current conversation. The original question, shuffle, manual selection, reveal, card library, three artwork styles, audio and language controls remain the original components. Provider API keys are never included in the widget. The plugin requests fullscreen when supported. Browser storage is best-effort because sandboxed hosts may disallow it.

## Local testing

```sh
npm ci
npm run plugin:dev
```

Open http://127.0.0.1:8787/preview. This uses an opaque sandbox and real MCP requests. Interpretation messages are captured in the preview, not sent to a model.

```sh
npm run typecheck
npm run plugin:test
npm run build
```

## One source, website and ChatGPT endpoint

`npm run build:vercel` builds the original website, builds the ChatGPT widget from the same `src/` components, and places its card artwork under the website's `/assets/` path. The build defaults the widget's static media URLs to `https://tarot.songhai.site`; `PUBLIC_BASE_URL` can override that for another deployment. The existing Vercel project serves both the website and the MCP endpoint at `/mcp`; `vercel.json` rewrites that path to `api/mcp.ts` before the website fallback. No second website or UI is maintained.

Set `TAROT_SIGNING_KEY` (at least 32 characters) in the Vercel Production environment so signed readings survive serverless cold starts and deploys. Keep it in Vercel's secret environment-variable store; never commit it. The MCP endpoint derives its public asset origin from the incoming request, so production cards load from the same domain as the site.

The previous OpenAI Sites export and Worker scripts remain legacy tooling; they are not part of the Vercel production build. The root `.openai/hosting.json` still describes the old Sites app and does not control the Vercel deployment.

For local integration testing, `node --import tsx --test tests/vercel-mcp.test.ts` exercises the Vercel web handler's preflight, origin policy, MCP discovery, staged draw, and same-origin card URLs. `npm run plugin:dev` remains the browser preview against the local Node MCP server.

After deploying, verify the website, `/mcp`, and the embedded UI separately: an HTTP or tool result alone does not prove that ChatGPT rendered the resource correctly.

## Refresh the installed ChatGPT app after publication

A successful Vercel deploy does not prove that a ChatGPT development app has refreshed its cached tool metadata. After its MCP endpoint is set to `https://tarot.songhai.site/mcp`, refresh tools in ChatGPT and reopen `open_tarot`. Verify the original dark starfield UI in ChatGPT itself, not only the website or local preview.

## Public website and shared assets

The public website and ChatGPT widget use the same Vercel project, canonical deck data, and card-art files. Card images load from same-origin `/assets/` URLs, so the widget needs no separately hosted asset site or pinned GitHub release. Verify anonymous card-image responses and the real ChatGPT iframe after deployment.
