# Frank Tarot MCP server

A thin MCP adapter around the original F.Tarot app. The website and hosted widget share `src/app/App.tsx`, components, animations, translations and artwork.

## Two tools

| Tool | Responsibility |
| --- | --- |
| `open_tarot(question?, spread?, locale?, flowId?)` | Open the original UI, prefill the question and spread, or resume the same widget. |
| `list_tarot_spreads(locale)` | List real spreads with descriptions and position labels for ChatGPT's smart selection. |

For an unspecified spread, ChatGPT lists and selects a suitable actual spread, then opens the app. The app's AUTO option sends an explicit spread-selection request to the conversation; ChatGPT applies its choice through `open_tarot`. The user then starts the ritual.

Starting, picking and flipping use the original frontend draw and UI. They make no MCP tool calls. A click on a drawn card attaches only that card's name, spread position and orientation as model context. It does not send a user message or trigger interpretation. Reveal progress and hidden cards stay private.

After all cards are revealed, **Interpret** sends the exact question and full spread to the current conversation. ChatGPT replies directly in chat. **Save Result** exports the current image, preserving the cards without interpretation or redraw.

## Recovery

The current widget holds the original app's private snapshot, including unfinished selection and reveal state. When available, ChatGPT's optional widget-state extension saves this under `privateContent`; model-visible content contains only the selected card or an explicitly submitted full reading. `open_tarot` with the existing `flowId` and no new question resumes that snapshot. Hosts without widget persistence can resume while the same widget remains mounted; recovery after unmount or across devices is not guaranteed.

Recovery uses only the current widget’s private state and `flowId`. Older server-generated reading tokens are unsupported.

## Local testing

```sh
npm ci
npm run mcp:dev
```

Open http://127.0.0.1:8787/preview. The preview uses real MCP and MCP Apps messages in an opaque sandbox. Interpret and smart-spread requests are captured locally; no model is called. Its controls only simulate opening a question or resuming the existing widget.

```sh
npm run typecheck
npm run mcp:test
npm run build:vercel
npm run test:vercel
```

## Deployment

`npm run build:vercel` builds the website, the original-app widget and Vercel handler. `PUBLIC_BASE_URL` overrides the default `https://tarot.songhai.site` asset origin. `vercel.json` serves the MCP endpoint at `/mcp` through `api/mcp.ts`.

No signing key or model API key is required. The frontend draws cards locally and does not send hidden cards or reveal progress to this endpoint.
