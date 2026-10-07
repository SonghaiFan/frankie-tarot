---
name: responsive-object-continuity
description: Build responsive UIs where objects keep their identity through every layout change — breakpoints (phone ↔ desktop), modes (grid ↔ detail, spread ↔ zoom, list ↔ modal), and state changes (reveal, filter, reorder) — by animating the change itself with Framer Motion (motion) layout animations (`layout`, `layoutId`, LayoutGroup, AnimatePresence) instead of letting things reappear somewhere else. Use when designing a responsive layout that differs between screen sizes, adding a transition between two views of the same content, or fixing a layout animation that jumps, starts from the wrong place, or only breaks on mobile, after scrolling, or inside an overlay.
---

# Responsive object continuity

## The idea

Responsive design changes the layout; it must not change **what the user is
looking at**. A card, photo or tile the user has noticed is an object with a
place. When the layout changes — the viewport crosses a breakpoint, a grid
opens into a detail view, a spread is revealed, a list is filtered — that
object should be seen to **travel** from its old place to its new one. If it
vanishes here and appears there, the user loses track of it and has to find
it again.

Three continuities make a layout change read as movement, not replacement:

1. **Position** — the first frame of the change draws the object exactly where
   it was; the last frame is exactly where it rests.
2. **Identity** — the same element (ideally the same DOM node) travels. Two
   copies handing over to each other are a fallback.
3. **State** — effects that belong to one layout (scroll fade, blur, tilt,
   rotation) unwind as part of the motion instead of snapping before or after.

Framer Motion's layout animation is the tool: an element with `layout`
measures itself before and after a React render and animates the difference
with transforms (FLIP), so any change of size or position — however it was
caused — becomes motion.

## Designing the layouts

### One tree, many arrangements

The usual way responsive code breaks continuity is by giving each screen size
or mode its own markup: `{isMobile ? <MobileView/> : <DesktopView/>}`, or the
same object rendered in one place when closed and another place when open.
React then destroys the element and creates a new one at every switch, and
nothing can travel.

Design the component as **one tree whose arrangement changes**: the object is
rendered once, at a fixed position in the tree, and the layout around it is
expressed by classes on stable wrappers. A wrapper that only matters in one
arrangement becomes `display: contents` in the others — it adds no box, so the
object still positions against the same ancestor:

```tsx
// The art is rendered once. On phones the open view puts it in a scroller
// with a pinned block; on desktop and when closed those wrappers vanish.
<div className={openOnPhone ? "absolute inset-0 overflow-y-auto" : "contents"}>
  <div className={openOnPhone ? "sticky top-0 h-[100dvh]" : "contents"}>
    <motion.div className={openOnPhone ? "flex h-full items-center justify-center" : "contents"}>
      <motion.div layout layoutId={`card-${id}`} className={slotOrDetailClasses} />
    </motion.div>
  </div>
  {open && detailText}
</div>
```

Because the element survives, crossing a breakpoint with the detail open, or
opening and closing it, is just a layout change — `layout` animates it.

### Choose the right layout tool

- **`layout`** — same element, new size or position (opening in place,
  reflowing on resize, a grid column count changing). The default choice.
- **`layout="position"`** — only position animates; use on text or anything
  that would visibly stretch while its size tweens.
- **`layoutId`** — the same logical object in two *different* components or
  screens (a card in the library and in a spread; a thumbnail and a modal).
  Use it to join genuinely different places, not to cover a remount you could
  avoid with one tree.
- **`LayoutGroup`** — siblings that should animate together when one of them
  changes (the others reflow around a card that grows), and to scope
  `layoutId`s so two lists don't steal each other's elements.
- **`AnimatePresence`** — objects that truly enter or leave (a filtered-out
  card): give them an exit, so leaving is also a visible movement.
- **`layoutDependency`** — when a layout change isn't caused by a re-render
  Framer can see, tell it what to watch.

### Rules for smooth layout animation

- **Keep the travelling element's transform its own.** Don't drive `scale`,
  `y`, `rotate` or `filter` on the `layout` element from scroll or gestures;
  wrap it and put those effects on the wrapper.
- **Declare scrolling and fixed ancestors.** A scrolling container whose
  scroll moves the object needs `layoutScroll`; a `position: fixed` overlay
  can need `layoutRoot`. These fix measurement for a surviving element — they
  do nothing for a remount.
- **Animate breakpoints, don't only restyle them.** When the arrangement
  depends on viewport size, drive it from state (e.g. `isMobile` from a resize
  hook) so the change is a React render that `layout` can animate, not just a
  CSS media query that snaps.
- **One duration language.** Use one easing and a similar duration for every
  layout move in the product, so objects feel like they live in the same
  physics.
- **Reduced motion** keeps identity and destination; shorten or cross-fade
  the travel, never drop the change.

## Debugging a transition: measure frame 0

Layout animation bugs are measurement bugs. Don't guess from the code —
record rectangles with `getBoundingClientRect()`:

- `visible` — where the object is drawn just before the change;
- `firstFrame` — right after triggering it, before any animation frame
  (`await new Promise(r => setTimeout(r, 0))`); Framer has already applied its
  "start from the old place" transform;
- `settled` — after it finishes, against the slot it should fill.

```js
const R = e => { const r = e.getBoundingClientRect();
  return [r.left, r.top, r.width, r.height].map(Math.round); };
const visible = R(art());
toggle();
await new Promise(r => setTimeout(r, 0));
console.log({ visible, firstFrame: R(art()), slot: R(slot()) });
```

Re-query the element after the toggle (`art()` as a function): if the node
you held is gone, it was remounted — that alone is the likely cause.

Then:

1. **Reproduce at every breakpoint and scroll position.** Responsive bugs
   hide in the layout you didn't test: try each breakpoint, the page scrolled
   to a known amount, and any inner scroller scrolled.
2. **Read how the error moves.** `firstFrame ≠ visible` is a wrong start;
   `settled ≠ slot` a wrong end. Vary one condition at a time; an error that
   scales with scroll, or appears only on one breakpoint, points at the code
   path that differs.
3. **Diff the trees, not just the styles.** Find where the working and broken
   arrangements render the object in different places.
4. **Test one cause at a time, live,** and keep a change only if `firstFrame`
   moves onto `visible`; revert the rest.
5. **Verify every direction** after a fix: open, close, close after inner
   scroll, settle, and crossing the breakpoint — at each size, page scrolled.

Automated browsers: a hidden preview pane throttles `requestAnimationFrame`,
so mid-animation samples freeze and look like bugs. Frame 0 is applied
synchronously and is reliable; keep the pane visible (take a screenshot
between steps) before sampling anything later.

## Worked example (this repo)

`src/features/tarot/components/RitualCard.tsx`: cards fly between their slot
(the spread in `RitualCardStage`, the grid in `DeckLibrary`) and a detail
view with `layout` + `layoutId`. The detail view is responsive: on desktop the
art sits beside the text; on phones it is pinned in a scroller under the
text, fading and blurring as the text scrolls over it.

On phones, closing a card after scrolling the page started its flight
~460 px too low (≈ 0.87 × the page scroll); desktop was fine. The phone path
rendered the art inside the detail scroller when open and back in the slot
when closed — two tree positions, so React remounted it and Framer's
`layoutId` handover measured the old copy off by the page scroll. Adding
`layoutRoot`, `layoutScroll`, removing `sticky`, and moving the scroll-driven
`scale` off the element each left frame 0 unchanged. Rendering the art once
at a fixed tree position, with `display: contents` wrappers for the phone
scroller, made frame 0 match the visible position in every direction, at both
breakpoints, with the page scrolled.

## Checklist

- [ ] Each tracked object is rendered once, at one tree position, in every breakpoint and mode.
- [ ] Arrangement-only wrappers are `display: contents` where they don't apply.
- [ ] Layout changes (including breakpoint switches) happen through React state, so `layout` can animate them.
- [ ] `layoutId` is used only to join different components or screens.
- [ ] The `layout` element carries no scroll- or gesture-driven transforms.
- [ ] Scrolling ancestors are `layoutScroll`; fixed overlays considered for `layoutRoot`.
- [ ] Frame 0 = visible and settled = slot: open, close, inner scroll, breakpoint change; every size; page scrolled.
- [ ] Reduced motion keeps identity and destination.
