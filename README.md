![Frankie Tarot](docs/readme/banner.png)

# Frankie Tarot

[English](README.md) · [简体中文](README.zh-CN.md)

A quieter space to choose your cards, reveal a spread, and reflect on a question.

[Open the app](https://tarot.songhai.site) · [Tarot API](https://github.com/SonghaiFan/frankie-tarot-api) · [Guide](docs/guide.md) · [Run locally](#run-locally)

## What it does

- Choose a spread and manually pick cards from the interactive table.
- Explore artwork, card packs and card backs in the library.
- Reveal a reading and return to its private recovery state.

## Run locally

```sh
npm ci
npm run dev
```

The app uses `https://tarot-api.songhai.site` by default. Public service URL options are documented in `.env.example`.

## Before you start

The app owns orientation and reading state and does not use the API’s random-draw endpoints. Choosing or revealing cards does not request an AI reading; interpretation follows an explicit user action.

## For developers

```sh
npm run typecheck
npm run build:vercel
npm run mcp:test
npm run test:interaction
npm run test:vercel
```

The project guide includes MCP preview setup and browser acceptance steps.

[Project guide](docs/guide.md) · [Artwork](docs/readme/README.md)

---

Made by [Songhai Fan](https://github.com/SonghaiFan) · A Frankie project · [License notes](docs/guide.md#license)
