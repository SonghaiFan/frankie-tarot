# PR #2 acceptance — 2026-10-14 (Melbourne)

Validated the original PR commit `1b5c38a` and then integrated current Frankie
main `d3f411b`. Franklin under test was merged main `71ee80f` (API PR #2).
The final acceptance applies to the integrated source, including the Home fix.

## Result

Real Chromium 153 exercised the actual application, bundled widget, MCP server,
MCP Apps AppBridge and Franklin REST/MCP services. Catalogs and visual components
were not mocked. The iframe host persisted private widget state and recorded
outgoing messages; its summary button simulated an AI response.

| Check | Evidence |
| --- | --- |
| Desktop (1280px) and mobile (390px) iframe | Both complete browser flows passed |
| Setup and Start | User chose Classic Trinity; double Start created one 78-card table and selected no cards |
| Duplicate selection | Two DOM click events on the same tile in one turn selected exactly one card; subsequent pointer clicks completed three unique selections |
| Mid-selection refresh | Entire saved table, orientations, picks, reading ID and progress were equal before and after reload |
| Last reveal | No interpretation message; `summaryRequested` stayed false; model context held only a selected card, without the private deck |
| Brief reading | Clicking sent the brief request and three one-based positions; no hidden table entered model context |
| Detailed interpretation | Clicking Interpret here sent the distinct deeper-analysis request with the same cards |
| Completed refresh | Exact cards and written summary restored; no message resent |
| Mobile standalone | Partial and final sessionStorage snapshots restored exactly; final reveal produced no summary |
| API boundary | Browser request capture contained no `/draw` or `/cards/random` request |
| Real catalog compatibility | Actual Frankie REST client loaded 78 cards and 11 spreads in both en and zh-CN; actual MCP adapter retrieved all 11 spreads in both locales |

All final automated checks passed: `build:vercel`, `typecheck` (after build),
`mcp:test` (25), `test:interaction` (1), `test:vercel` (2), and `git diff --check`.
The browser script adds three real-browser flows under `test:browser`.

## Minimal repair

The PR's repeat-Start guard retained the old reading ID after Home navigation.
Home → Start → Start remained at INPUT and could not open a new reading. A new
regression assertion failed with `INPUT !== PICKING` before the fix and passed
after it. Home and Seek again now share a private-table reset; Home clears the
old reading without playing the question voice, while Seek again retains its
existing voice behavior. The duplicate-Start guard remains intact.

## Reproduce browser acceptance

Start merged Franklin locally on port 3001. In Frankie:

```sh
npm ci
npx playwright install chromium
VITE_TAROT_API_URL=http://127.0.0.1:3001 npm run mcp:build
CORE_MCP_URL=http://127.0.0.1:3001/mcp/agent npm run mcp:start
```

In separate terminals, start the standalone client and run the browser checks:

```sh
VITE_TAROT_API_URL=http://127.0.0.1:3001 npm run dev -- --host 127.0.0.1
TAROT_WEB_URL=http://127.0.0.1:3000 npm run test:browser
```

`TAROT_CHROMIUM_PATH` supports an existing Chromium binary. This environment's
Playwright CDN download failed; Chromium was obtained from the npm-packaged
`@sparticuz/chromium` browser and used through Playwright. No such binary or
environment-specific paths are committed to the application.

## Limits retained

- Netlify's provided preview returned “Site not found”. The same-commit Vercel
  preview was found but required Vercel authentication. Neither deployment
  status was counted as interaction evidence.
- The default public API fetch failed in this test browser. Acceptance instead
  used the actual merged Franklin services locally; production reachability
  and cross-origin behavior have not been certified here.
- No callable Frankie plugin/real ChatGPT widget was available in this session.
  Real ChatGPT model selection, optional widget persistence and embedded
  rendering remain unverified. AppBridge testing is not real-host acceptance.
- Historical snapshots lacking a saved table preserve existing picks, but
  cannot reproduce unseen tiles; those tiles are redealt once. Hosts without
  persistence cannot guarantee recovery after unmount or across devices.
- Existing build-size/annotation warnings and react-test-renderer's deprecation
  warning do not affect the passing checks and were not expanded into this fix.
