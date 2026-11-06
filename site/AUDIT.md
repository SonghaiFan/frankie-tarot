# Tarot introduction: code and current UI audit

Audited 2026-11-06. Scope is `site/` plus the banner input-watch path in Pages. App behavior, service settings, keys and repository visibility were not changed.

## Design read

An explanatory introduction to a manual tarot table, preserving the current Aura’s near-black sky (#030308), light lettering (#f0ede8), Jost-style display rhythm, clear rounded controls, original card artwork and star/sea homepage. Variance5, motion1, density3. Native CSS and real screenshots keep the static intro lightweight. Actual dark app identity overrides a generic light/dual-theme template. No decorative generated visuals or new dependencies.

## Real app opened

Opened https://tarot.songhai.site in shared Ego workspace9/p2. Switched to English, inspected the current star/sea home, opened its actual library and all three pack descriptions, returned to drawing, reselected a spread and inspected the eleven current layouts. Selected Classic Trinity, entered a clearly labelled sample question, and entered its real manual-picking table. Attempted one canvas pick; the card count is not exposed as remaining-text in the DOM, so no completed-three-card claim is made. No external AI service, host summary, paid model call, account data or device permission was used.

Four current captures are `home-current.png`, `library-current.png`, `spreads-current.png` and `picking-current.png`. They are genuine UI screenshots, not recreated interfaces. The current home capture is used in the hero. Original Fool/Star assets and the clearly labelled earlier recorded home GIF are retained.

## Owning source examined

- `src/app/App.tsx`: stage flow, local hidden table, count/pool checks, reveal and reset; standalone session storage; optional host callbacks.
- `src/app/main.tsx`: standalone app mounts without `TarotHost`.
- `src/features/tarot/components/InputSection.tsx`: spread-first/question-second flow, catalog descriptions, suggested prompts and action labels.
- `src/features/tarot/utils/localDraw.ts`, `cardPools.ts`: Fisher–Yates hidden card assignment, unique picks, API pool membership, orientation assigned at deal.
- `src/features/tarot/components/PickingSection.tsx`, `PickingCloudCanvas.tsx`: manual canvas interaction and table controls.
- `src/features/tarot/components/ReadingSection.tsx`: reveal presentation, Open in AI provider menu, image save and optional host-only actions. Opening a provider prepares interpretation context; this static intro never sends it.
- `src/features/tarot/constants/cardPacks.ts`, `cardFaceStyles.ts`, `cardBacks.ts`, `components/DeckLibrary.tsx`: three face/back pack pairings, independent customization, suit filters.
- `src/api/client.ts`, `src/api/defaults.ts`, `constants/spreads.ts`: public catalog service, current revision and runtime-owned spread metadata. Current catalog loaded successfully during inspection.
- `src/host/readingSnapshot.ts`, `src/shared/storage.ts`: validated tab recovery and local appearance preferences. No durable account archive/sync claim.
- `src/app/index.css`, `IntroSection.tsx`, `SkyScene.tsx`: actual palette, display typography, clear controls and star/sea scene.

## Primary concept evidence

The positions explainer uses the app’s own public spread API response (`site/catalog-sample.json`, source URL and capture date included), with one-card Insight and Classic Trinity Past/Present/Future labels in both languages. It is a source-data diagram, not a simulated full app or random draw. Tarot concepts are explained as this implementation’s interpretive layouts and orientation; no historical, medical, financial or forecasting claims are added. API catalog and owning source are the primary references for those factual implementation details.

## Checks

- Standard-library Python build generated English root and Chinese `zh/`, with no app build, env reads or live API call during CI.
- Local link/asset checker:2 HTML pages, zero issues. JS syntax and diff whitespace checks passed.
- Real browser desktop checked at1468px with no horizontal overflow or broken loaded images.
- Real390×844 target viewport: English and Chinese each scrollWidth390/innerWidth390. Switched the actual-catalog controls and confirmed Past/Present/Future and 过去/现在/未来 labels. Selected button states update. Desktop/mobile screenshots visually inspected; per-page device override cleared afterward.
- No Lighthouse score claimed; no model response, hosted conversation integration or image-download action tested for this intro-only work.
