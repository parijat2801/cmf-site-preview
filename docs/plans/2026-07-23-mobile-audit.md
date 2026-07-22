# Mobile / tablet audit — 2026-07-23

Method: real 390px viewport via an iframe probe (browser zoom made window-resize
unreliable; media queries inside an iframe resolve against the iframe width, so
`(max-width:860px)` and `(max-width:760px)` genuinely fire).

Worktree: /Users/parijat/dev/cmf-responsive  branch feature/responsive-breakpoints
Served: http://localhost:8060

## What is already good (do not touch)

- **No horizontal overflow at 390px.** `scrollWidth` 375 vs viewport 390, zero
  elements escaping the viewport. The most common mobile bug class is absent.
- **Nav collapses correctly** (`max-width:760px` hides the link list, keeps logo +
  IG + Contact).
- **Brigade grid** reads well 2-up: names legible, yellow role tags clear.
- **Pin architecture is already mobile-aware**: `gsap.matchMedia()` at 860px,
  dwell scaled `k=0.6` on phones, `fitPass()` shrinks `--fz` to fit the viewport,
  and `talls[]` bottom-pins any card taller than the screen so nothing is clipped.
  All four lower cards are `.nopin` already, so there is no card-stacking on mobile.

## Findings, by severity

### 1. 13 live WebGL canvases on a phone  (perf — highest impact)
`document.querySelectorAll('canvas').length === 13` at 390px. All appear to run
their own rAF loop regardless of whether they are on screen.
Fix order (from research, highest impact first):
  a. IntersectionObserver pause/resume on every canvas + `document.hidden` gate.
  b. Cap DPR: 1.5 for the 2D fragment shaders (axes, highlighters), 2 for the
     hero balloon. Currently uncapped against `devicePixelRatio` 2-3.
  c. `prefers-reduced-motion` hard override.
  d. `precision mediump float` + fewer noise octaves in the fragment shaders.
  e. Optional 30fps cap for decorative shaders (halves GPU work, imperceptible).
Keep it CONFIGURABLE per the user's instruction — a quality tier, not a kill switch.

### 2. Filmstrip accordion is unusable at 390px  (layout — needs redesign)
"Who are we building for?" keeps the desktop horizontal accordion: one open panel
plus three ~55px slivers. Inactive labels are clipped mid-word — "The Expr…",
"The Cultu Fluid", "The (Mis)f…". A horizontal accordion cannot work at this width.
Needs a genuine mobile layout (stacked cards / vertical accordion / swipe), not a tweak.

### 3. Chart loses its meaning on mobile  (layout — needs redesign)
The `for-brands` graph renders its crayon axes, but the four quadrant labels that
carry the argument are missing at 390px; only the "Scale" / "Cultural Impact" axis
labels survive. The alien logo floats with nothing to read it against, and the
handwritten question above is clipped at the top edge.

### 4. `100vh` + resize-triggered ScrollTrigger.refresh()  (jank risk)
`.card{min-height:100vh}`, `.mf-ustage{height:100vh}` and `const vh=()=>window.innerHeight`.
On mobile the collapsing URL bar changes `innerHeight`, fires `resize`, and the
debounced `ScrollTrigger.refresh()` recalculates every pin MID-SCROLL. This is the
classic cause of pins jumping on phones. Use `dvh`/`svh` and ignore height-only
resizes on touch devices.

### 5. Type + tap targets  (polish)
- 28 elements below 12px. Role tags (`.mrole`) at 9.3px, nav/labels at 11.2px.
- Several tap targets under 40px (the IG icon is 20x20).

## Not yet verified
- Tablet 768 / 1024.
- Real touch scrolling through the pinned deck (Lenis + pin interaction).
- iOS Safari specifically (only Chrome available here).
