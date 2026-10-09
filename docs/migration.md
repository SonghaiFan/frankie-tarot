# Project and domain rules

| Project | Canonical public origin | Responsibility |
| --- | --- | --- |
| frankie-tarot | https://tarot.songhai.site | Web app and UI MCP at /mcp |
| franklin-tarot-api | https://tarot-api.songhai.site | Docs at /, REST at /api/v1, Agent MCP at /mcp/agent |

`frankie-*` names apps; `franklin-*` names APIs and developer tools. Public URLs use product names under `songhai.site`. Cloudflare owns DNS; Vercel is the current deployment provider. Changing providers does not change public URLs.

Greenfield policy: no old API routes, legacy identifiers, historical widget aliases, or GitHub Pages redirects. Current-session recovery and repeat-operation consistency remain required. Frankie has no network draw request to retry: it retains the local table and orientations and ignores duplicate selections. Franklin random draws have no public seed or idempotency key. The frontend assigns numeric positions to the loaded catalog for its visual layout; external card identity is always the stable API string ID.

Refresh the ChatGPT connection after releasing a changed widget descriptor. Browser/protocol tests do not substitute for a real host acceptance test.

## Draw ownership and client contract

- REST catalog loading (`loadApiDeck`, `loadApiSpreads`) may retry; it must not create a reading or pick cards. Franklin's `/spreads/{spreadId}/draw` and `draw_tarot_spread` are for explicitly authorized delegated draws by other consumers, not the Frankie UI flow.
- Start creates a private shuffled table but selects no cards. Each click fills the next zero-based local array position; exported context uses one-based positions. Respect the current position's pool and reject duplicate cards or tiles.
- Save the table (including hidden cards and orientations) only in private recovery state, never in model context. Restore saved picks, order, orientation, reveal progress and remaining tiles without reshuffling. Older snapshots without a table retain their chosen cards but cannot reconstruct unseen tiles; only those unsaved tiles are redealt once.
- Reveal is separate from interpretation. Brief reading and Interpret require explicit clicks after all cards are revealed; opening, setup, restore and the final reveal must not send an interpretation request. A failed request can resend the same saved cards, without drawing again.
- A future server-draw migration must first define explicit consent, position mapping, retry identity and exact private restoration end to end. Current Franklin random draws do not satisfy that contract.
