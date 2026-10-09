# Frankie Tarot

The user-facing bilingual tarot app and ChatGPT UI. Frankie owns the card table, visual layouts, reveal interactions and private recovery state. [Franklin Tarot API](https://github.com/SonghaiFan/franklin-tarot-api) owns card data, spread definitions and optional random draws for other API consumers and AI agents. Frankie does not use those server draws.

- App: https://tarot.songhai.site
- Plugin MCP: https://tarot.songhai.site/mcp
- API documentation: https://tarot-api.songhai.site/
- API: https://tarot-api.songhai.site

## Local development

```sh
npm ci
npm run dev
```

The app talks to https://tarot-api.songhai.site by default. Set `VITE_TAROT_API_URL` to point it at a local or staging API instead.

The browser loads cards and spreads over REST, shuffles locally, and assigns each user-clicked tile to the next spread position subject to its card pool. The private snapshot retains the dealt table, orientations, picks and reveal state. Duplicate tile clicks do not draw again. Catalog failures can be retried without changing an existing table. There is no server seed or draw retry contract, and no bundled meanings fallback.

For the plugin adapter, configure `CORE_MCP_URL=https://tarot-api.songhai.site/mcp/agent` as well. It uses a standard MCP client to retrieve spread definitions; reading context is assembled and validated locally. The widget loads REST catalogs on mount. Opening or setting up the widget does not pick cards. Hidden cards and the full reading snapshot stay in private UI state; full context is sent only after all cards are revealed and the user clicks Brief reading or Interpret. Revealing the final card does not automatically request either action.

Use `.env.example` as a template for these public service URLs. Do not put secrets in `VITE_` variables.

## Build and test

```sh
npm run build:vercel
npm run typecheck
npm run mcp:test
npm run test:interaction
npm run test:vercel
```

Interaction tests mount the real App and REST client with visual/audio adapters stubbed; they do not replace a browser or real ChatGPT acceptance test.

The last test imports the built Vercel handler, so build first. For a local MCP AppBridge preview, set `CORE_MCP_URL` and use `npm run mcp:dev`; the preview checks protocol and embedding behavior, not the real ChatGPT host.

Vercel serves the Web app and `/mcp` from one project. Only the current content-addressed widget resource is served. Refresh the ChatGPT connection after a UI release. GitHub Pages is not a deployment target.

## Naming and migration

`frankie-*` means a user-facing app; `franklin-*` means an API or developer tool. The original application repository and its Git history retain the Frankie name. The service and docs have their own repository and deployment. See [migration verification](docs/migration.md).

应用前缀使用 Frankie，API 与开发者工具使用 Franklin。两者通过公开接口连接；刷新、重试和追问保留同一次牌局，不重新抽牌。

## License

MIT, as stated by the existing project. Card-data provenance is documented by the Franklin API.
