# Frank Tarot in ChatGPT

This is a host adapter inside the original Frank Tarot repository, not a second app.

- UI entry: `src/app/App.tsx` for both the website and ChatGPT.
- Components, animations, styles, translations and card artwork: existing `src/` and `public/`.
- Canonical card/spread data: `src/features/tarot/data/ground-truth.json`.
- `ui/index.tsx` connects MCP to the original App through `src/host/tarotHost.ts`.
- UI resource URIs include a hash of the built HTML so a host cannot reuse a previous UI under the same identifier. The preview discovers the URI from tool metadata.
- `mcp.ts` declares the tools and UI resource, shared by local and Vercel handlers.
- `engine.ts` adds server-side secure draws and signed recovery tokens over canonical data.

The ChatGPT host supplies interpretation in the current conversation. The original question, shuffle, manual selection, reveal, card library, three artwork styles, audio and language controls remain the original components. Provider API keys are never included in the widget. The table and result open inline by default. The table reserves 640 pixels of inline height for the original viewport-based app; its fullscreen button requests the host's expanded presentation. Returning to the table from a result stays inline. ChatGPT owns its tab controls and chat/composer visibility; the plugin does not manipulate the host interface. Browser storage is best-effort because sandboxed hosts may disallow it.

## One active interaction in ChatGPT

The first `open_tarot` creates a `flowId`. All table and result tools share one resource URI, and every response carries `openai/widgetSessionId=flowId`, following the official Apps SDK Cards Against AI example. The host can route subsequent tool results into that existing iframe; `ontoolresult` switches the original app to its result composition or back to the table. A new question in the same conversation reuses `flowId` but creates a new draw only after the user starts it. Independent first launches get different IDs. The authenticated session envelope preserves `flowId` across flips and result calls, including serverless cold starts.

| User action | Tool / stage | Presentation |
| --- | --- | --- |
| Mention the app with a question | `open_tarot(question, flowId?)` / input | Existing original table, question filled |
| Start shuffle and select | `draw_tarot_cards(flowId)` / picking | Same window; model cannot see hidden cards |
| Flip cards | `reveal_tarot_cards(sessionToken)` / reveal or ready | Same table; interpretation still requires an explicit request |
| Request interpretation | `show_tarot_result(intent="interpret")` / result | Same window becomes the brief shared result card |
| Save result | Direct `show_tarot_result(intent="save")` | Same window becomes the saved result; chat only acknowledges |
| Ask deeper | User message with the shared follow-up prompt | Ordinary chat, result unchanged |
| Return to table or ask a new question | `open_tarot(sessionToken)` or `open_tarot(question, flowId)` | Same interaction slot |

`nextAction` makes the next human step explicit in tool output. Widget reuse is host behavior and must be verified in the target ChatGPT client. Already-posted older widgets cannot be deleted by this server. A client that ignores widget session binding may still show multiple historical widgets.

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

## ChatGPT web and desktop

The personal ChatGPT connection is registered against the existing public Vercel endpoint at `https://tarot.songhai.site/mcp`. Its verified ID is stored in `.app.json`; `plugin.json` references that mapping through `extensions.com.openai.apps`. The portable `mcp.json` remains available to desktop MCP clients. Both hosts use the same tools, staged reading state, original UI and Vercel deployment.

Generate the account plugin package with `npm run plugin:configure -- --url https://tarot.songhai.site/mcp`. The generated package includes the registered app mapping by default, so subsequent icon or metadata updates do not accidentally restore a desktop-only package. For another ChatGPT account, register the endpoint there and supply its own verified ID with `--app-id plugin_asdk_app_…`.

Open F.Tarot in ChatGPT on the web, or start a Work chat and select F.Tarot with `@`. A question should open the original input stage; cards stay hidden until the user chooses and reveals them. Only request interpretation after all selected cards are visible.

## Refresh the installed ChatGPT app after publication

A successful Vercel deploy does not prove that a ChatGPT development app has refreshed its cached tool metadata. After its MCP endpoint is set to `https://tarot.songhai.site/mcp`, refresh tools in ChatGPT and reopen `open_tarot`. Verify the original dark starfield UI in ChatGPT itself, not only the website or local preview.

## Public website and shared assets

The public website and ChatGPT widget use the same Vercel project, canonical deck data, and card-art files. Card images load from same-origin `/assets/` URLs, so the widget needs no separately hosted asset site or pinned GitHub release. Verify anonymous card-image responses and the real ChatGPT iframe after deployment.

“Save result / 保存结果” exports a PNG on the website. In ChatGPT it calls `show_tarot_result` directly and replaces the current interaction with the shared `ReadingCard` result page. Chat acknowledges the saved result without publishing a duplicate widget. Saving preserves the current draw, artwork style and any existing interpretation; it never asks for a new interpretation. The component used for image export is also the result composition in the plugin, with interactive controls outside it. The optional reflection field has been removed; “Interpret with ChatGPT” remains a separate action after all cards are revealed.

The initial interpretation uses the website's `buildTarotReadingPrompt`: one cohesive paragraph, 120–180 Chinese characters or 130–180 English words. Fully revealed app/tool context supplies this exact prompt. `show_tarot_result(intent="interpret")` accepts only a brief paragraph and returns the website's `buildTarotFollowUpPrompt` so ChatGPT continues with deeper analysis in ordinary chat outside the result card. The “Ask Deeper / 深入问问” button sends that same copied website prompt into the current conversation. Detailed follow-ups preserve the brief result. `intent="save"` (the default) preserves existing text and never requests deeper analysis; prompts containing the complete spread are withheld until every card is revealed.
