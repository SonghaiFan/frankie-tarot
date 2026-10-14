# Picking force layout (local prototype)

The picking table keeps the shared GPU card-back renderer and DOM hit targets / shared-layout flights. `d3-force` updates only each card's outer position wrapper. The GPU reads the same in-memory poses: no per-card bounding-box reads or React state updates in the physics loop.

- A seeded shuffled ring plus sparse extra edges connects all 78 identities. Picking removes only that card's edges, without rewiring the remainder.
- Links, short-range repulsion and density-aware soft collision let neighbors react. Partial overlap is intentional on small screens; full non-overlap of 78 cards is not physically possible there.
- Rotated card extents are clamped to the measured safe picking area. Resizing preserves existing nodes and re-constrains them.
- Pointer capture and an 8 px movement threshold distinguish dragging from picking. A moved gesture suppresses its compatibility click; taps retain the existing WebKit double-pick protection.
- Dragging raises the same card in both DOM and GPU ordering. Neighbor links brighten while held.
- Physics uses a bounded fixed 60 Hz timestep and cools to sleep. While active, its frame drives GPU drawing; after cooling, only the existing aura animation continues. Hidden documents stop work. Reduced-motion entry settles immediately.

## Validation

`npm run test:force` exercises native Chromium touch at 390×844 / DPR 3 / 4× CPU slowdown, neighbor motion, dragging outside bounds, resize, drag-versus-tap, and desktop mouse dragging. `TAROT_BROWSER=webkit npm run test:force` exercises the same assertions using mouse dragging plus native touch tapping in WebKit.

The mobile Chromium sample before the desktop test measured mean 18.04 ms and p95 18.60 ms over 282 frame intervals, including drag, cooling and resizing. This is local browser emulation, not a physical iPhone performance claim.

`npm run test:picking` covers 10 native WebKit taps, recovery after nine picks, resize, and revealing all ten cards. `TAROT_DISABLE_WEBGL=1 npm run test:picking` covers the DOM fallback. Typecheck, build and the application interaction regression are also required.

This interaction prototype has not been deployed.
