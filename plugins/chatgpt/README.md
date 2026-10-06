# Frank Tarot in ChatGPT

Public directory preparation: [listing copy](LISTING.md), [review cases, demo plan and data inventory](SUBMISSION.md). `npm run plugin:submission` produces an allowlisted public draft archive without the private app binding. Missing recording, category and portal checks are reported separately; a generated draft is not ready for review.

This is a host adapter inside the original Frank Tarot repository, not a second app.

- UI entry: `src/app/App.tsx` for both the website and ChatGPT.
- Components, animations, styles, translations and card artwork: existing `src/` and `public/`.
- Canonical card/spread data: `src/features/tarot/data/ground-truth.json`.
- `ui/index.tsx` connects MCP to the original App through `src/host/tarotHost.ts`.
- UI resource URIs include a hash of the built HTML so a host cannot reuse a previous UI under the same identifier. The preview discovers the URI from tool metadata.
- `mcp.ts` declares the tools and UI resource, shared by local and Vercel handlers.
- `engine.ts` adds server-side secure draws and signed recovery tokens over canonical data.

The ChatGPT host supplies interpretation in the current conversation. The original question, shuffle, manual selection, reveal, card library, three artwork styles, audio and language controls remain the original components. Provider API keys are never included in the widget. The original app opens inline by default, including its reading stage. The table reserves 640 pixels of inline height for the original viewport-based app; its fullscreen button requests the host's expanded presentation. ChatGPT owns its tab controls and chat/composer visibility; the plugin does not manipulate the host interface. Browser storage is best-effort because sandboxed hosts may disallow it.

## One active interaction in ChatGPT

The first `open_tarot` creates a `flowId`. All table and result tools share one resource URI, and every response carries `openai/widgetSessionId=flowId`, following the official Apps SDK Cards Against AI example. The host can route subsequent tool results into that existing iframe; `ontoolresult` updates the original app, including its existing reading area. There is no separate result page. A new question in the same conversation reuses `flowId` but creates a new draw only after the user starts it. Independent first launches get different IDs. The authenticated session envelope preserves `flowId` across flips and result calls, including serverless cold starts.

| User action | Tool / stage | Presentation |
| --- | --- | --- |
| Mention the app with a question | `open_tarot(question, flowId?)` / input | Existing original table, question filled |
| Start shuffle and select | `draw_tarot_cards(flowId)` / picking | Same window; model cannot see hidden cards |
| Flip cards | `reveal_tarot_cards(sessionToken)` / reveal or ready | Same table; context-only update, next position shown |
| Request interpretation | Exact `interpretationPrompt` message | Direct answer in chat |
| Save result | Shared `renderReadingImage` + host file export | PNG export; table and reading stay unchanged |
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

Vercel is the production host. The former Sites export scripts, vendored bridge and Worker configuration have been removed.

For local integration testing, `node --import tsx --test tests/vercel-mcp.test.ts` exercises the Vercel web handler's preflight, origin policy, MCP discovery, staged draw, and same-origin card URLs. `npm run plugin:dev` remains the browser preview against the local Node MCP server.

After deploying, verify the website, `/mcp`, and the embedded UI separately: an HTTP or tool result alone does not prove that ChatGPT rendered the resource correctly.

## ChatGPT web and desktop

The personal ChatGPT connection is registered against the existing public Vercel endpoint at `https://tarot.songhai.site/mcp`. Its verified ID is stored in `.app.json`; `plugin.json` references that mapping through `extensions.com.openai.apps`. The portable `mcp.json` remains available to desktop MCP clients. Both hosts use the same tools, staged reading state, original UI and Vercel deployment.

Generate the account plugin package with `npm run plugin:configure -- --url https://tarot.songhai.site/mcp`. The generated package includes the registered app mapping by default, so subsequent icon or metadata updates do not accidentally restore a desktop-only package. For another ChatGPT account, register the endpoint there and supply its own verified ID with `--app-id plugin_asdk_app_…`.

Open F.Tarot in ChatGPT on the web, or start a Work chat and select F.Tarot with `@`. A question should open the original input stage; cards stay hidden until the user chooses and reveals them. Visible cards may be discussed individually; the full-spread prompt waits until every card is visible.

## Refresh the installed ChatGPT app after publication

A successful Vercel deploy does not prove that a ChatGPT development app has refreshed its cached tool metadata. After its MCP endpoint is set to `https://tarot.songhai.site/mcp`, refresh tools in ChatGPT and reopen `open_tarot`. Verify the original dark starfield UI in ChatGPT itself, not only the website or local preview.

## Public website and shared assets

The public website and ChatGPT widget use the same Vercel project, canonical deck data, and card-art files. Card images load from same-origin `/assets/` URLs, so the widget needs no separately hosted asset site or pinned GitHub release. Verify anonymous card-image responses and the real ChatGPT iframe after deployment.

“Save result / 保存结果” renders a PNG using the same `ReadingCard` component and `renderReadingImage` on both surfaces. The website downloads it directly. In an MCP host, the adapter uses advertised `ui/download-file` support, or ChatGPT's optional `window.openai.uploadFile(file, {library:true})` with a download link when available. An unsupported host reports an export failure rather than claiming a file was saved. File-library storage is not a guarantee that the conversation Outputs list will register the image; no documented direct Outputs registration API has been verified. Saving never calls `show_tarot_result`, changes the table, redraws, or generates a new interpretation.

The “深入解读 / Explore deeper” button sends `interpretationPrompt` verbatim, without procedural text or a second follow-up. ChatGPT answers directly in ordinary chat. The prompt still uses the shared website builder (one cohesive paragraph, 120–180 Chinese characters or 130–180 English words). `show_tarot_result` remains optional for an explicit request to put a brief reading in the table; it is not part of the normal interpretation flow. Complete-spread prompts remain withheld until every card is visible.

## Natural-question and reveal flow

When a question does not specify a spread, ChatGPT lists the canonical spreads, chooses a suitable one and opens setup with the original question and that spread. An explicit user choice takes precedence. ChatGPT suggests the side tab / expanded mode; the user still shuffles, picks and reveals manually.

Model-visible state includes `revealOrder`, `nextReveal`, `newlyRevealed`, and `canInterpretRevealed`. Hidden card identities remain private. On a model turn, ChatGPT may discuss newly visible cards and guide the next position unless the user asked to wait. `canInterpret` continues to gate the full-spread prompt. Duplicate reveals and session restoration do not report fresh flips.

**Host limitation:** the installed MCP Apps SDK documents `updateModelContext` as context for the next model turn, not an immediate-response trigger. Selection and flips only update context; they never send fabricated user messages. Thus live per-flip assistant responses are not implemented without a real user turn. The table itself displays the next position immediately. The final explicit button is the only interpretation message send. Verify actual model behavior and expanded placement in ChatGPT; the local preview captures messages but does not run a model.
