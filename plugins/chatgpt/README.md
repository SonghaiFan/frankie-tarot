# Frank Tarot in ChatGPT

This is a host adapter inside the original Frank Tarot repository, not a second app.

- UI entry: `src/app/App.tsx` for both the website and ChatGPT.
- Components, animations, styles, translations and card artwork: existing `src/` and `public/`.
- Canonical card/spread data: `src/features/tarot/data/ground-truth.json`.
- `ui/index.tsx` connects MCP to the original App through `src/host/tarotHost.ts`.
- `mcp.ts` declares the tools and UI resource, shared by the local server and deployed Worker.
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

## One source, two build targets

`npm run build` builds the original website. `PUBLIC_BASE_URL=https://frank-tarot.frankf.chatgpt.site npm run build:site` builds that same website plus its MCP Worker. No second UI is maintained.

The Site build uses ffmpeg to produce a compact mono delivery copy of the original background soundtrack; the original master stays in this repository.

The existing Site is bound by the root `.openai/hosting.json`. Keep its project and plugin IDs. Configure `PUBLIC_BASE_URL` and secret `TAROT_SIGNING_KEY` in the hosting environment. Do not commit secrets.

For Sites publication, `node scripts/site/export.mjs <existing-sites-checkout>` produces a generated deployment mirror of this repository and its build output. Edit only this repository; never edit the generated mirror. The Sites source helper then saves/pushes/packages that exact generated snapshot. It is hosting transport, not a second maintained project. The previous standalone Sites UI is replaced.

After deployment, verify the MCP tools and the embedded UI separately: an HTTP or tool result alone does not prove the ChatGPT UI rendered correctly.
