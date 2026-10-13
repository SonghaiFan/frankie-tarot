# Mobile picking renderer

The picking cloud now draws all unselected card backs into one WebGL canvas. The DOM still owns hit testing, accessibility, positions, entrance/hover animation and shared-layout flights into the selected row. Settled geometry is cached; resize, card removal and active transitions invalidate it. The procedural aura, 16-tap blur, palette, frames and card-back motif remain animated. The renderer prepares during camera travel and releases its resources when the picking stage unmounts. WebGL failure falls back to the existing DOM backs.

This removes the cloud's per-card 2D canvases and GPU-to-CPU copies. Selected cards still use the existing shared aura renderer, so the change does not eliminate every Canvas copy on the page.

Touch selection runs on pointer release, rejects cancelled/moved gestures, and suppresses WebKit's compatibility mouse click at the stable stage ancestor. WebKit can retarget that click to the next card after the selected node disappears. Mouse and keyboard selection continue to use their existing paths.

## Diagnostic comparison

2026-10-14, headed Chromium, 390×844, DPR 3, 4× CPU slowdown. Both URLs were measured in the same CDP session, with the same restored Celtic Cross table and nine selected cards. Each sample was four seconds. The baseline was the deployed site before this fix; the candidate was the local Vite development server.

| Metric | Deployed baseline | Candidate |
| --- | ---: | ---: |
| Cloud 2D canvases | 69 | 0 (one shared WebGL surface) |
| Page-wide `drawImage` calls | 17,222 | 2,410 |
| Mean frame interval | 18.45 ms | 16.68 ms |
| p95 frame interval | 32.7 ms | 18.6 ms |
| Main-thread tasks over 50 ms | 0 | 0 |

These are single-run diagnostics, not an iPhone FPS guarantee. The original report concerned a physical iPhone; neither desktop CPU throttling nor desktop WebKit reproduces its GPU, thermal or browser conditions.

## Regression checks

`npm run test:picking` uses installed Playwright WebKit by default. Set `TAROT_BROWSER=chromium` to use Chrome, or `TAROT_DISABLE_WEBGL=1` to verify fallback. `TAROT_TEST_URL` defaults to `http://127.0.0.1:3002` and can target a preview/production deployment.

The real-browser check uses the live catalog, selects ten cards through native touch input, asserts one card per touch and an unchanged deal, refreshes after nine picks, resizes, selects the tenth and reveals all ten. It checks GPU-surface cleanup and shader errors. No automatic interpretation is requested. Screenshots go to `output/playwright`.

WebKit, Chromium and WebKit without WebGL passed the ten-card flow locally. `typecheck`, production build, interaction-state test and all 25 MCP unit tests passed. Plugin iframe browser acceptance also passed at 1280px and 390px with `CORE_MCP_URL` pointing to the independent Franklin service.
