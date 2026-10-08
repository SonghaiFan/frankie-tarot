# Project and domain rules

| Project | Canonical public origin | Responsibility |
| --- | --- | --- |
| frankie-tarot | https://tarot.songhai.site | Web app and UI MCP at /mcp |
| franklin-tarot-api | https://tarot-api.songhai.site | Docs at /, REST at /api/v1, Agent MCP at /mcp/agent |

`frankie-*` names apps; `franklin-*` names APIs and developer tools. Public URLs use product names under `songhai.site`. Cloudflare owns DNS; Vercel is the current deployment provider. Changing providers does not change public URLs.

Greenfield policy: no old API routes, legacy identifiers, historical widget aliases, or GitHub Pages redirects. Current-session recovery and deterministic draw retries remain required. The frontend assigns numeric positions to the loaded catalog for its visual layout; external card identity is always the stable API string ID.

Refresh the ChatGPT connection after releasing a changed widget descriptor. Browser/protocol tests do not substitute for a real host acceptance test.
