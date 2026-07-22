# Mobile / tablet pass — 2026-07-23

Worktree: /Users/parijat/dev/cmf-responsive  branch feature/responsive-breakpoints
Served: http://localhost:8060

Method: a real 390px viewport via an iframe probe. Window resizing alone was not
trustworthy here (the page reported ~1589 CSS px in a 430px window), so media
queries never fired; inside an iframe they resolve against the iframe width.

## Done

1. **Filmstrip goes vertical on phones.** The horizontal accordion left three
   panels as ~55px slivers with labels clipped mid-word ("The Expr…", "The Cultu
   Fluid"). Below 760px the four panels stack as full-width 16/10 banners, all in
   colour. The GSAP scrub still runs but is visually neutralised — no JS change.
   Desktop/tablet untouched.

2. **Artist wall 3-up on phones** (was 2-up). At ~105px per cell the overlay
   caption had to shrink to ~11px name / ~7px tag to avoid overflowing, which was
   unreadable. So the caption moved OUT from over the photo to beneath it, where it
   has the full cell width. Tag size then tuned down on request.

3. **Type scale.** Every heading sizes off `clamp(floor, min(Nvw,Mvh), ceiling)`.
   On a phone `min(vw,vh)` always takes the vw side, which lands under the floor —
   so `.head`, the manifesto h3 and the reel head ALL rendered at an identical
   38.4px. Three levels reading as one. Restated in vw only with real intervals:
   head 47 / manifesto 42 / lead 21 / body 17 / label 13.

   The hero was worse: `.mega` had NO lower bound, so 4.5vw put the opening
   statement at 17.6px — body-copy size. Floored to ~29px at 390px.

4. **Hero overflow.** The floor trades against the `.ph` "shrink, never break a
   phrase" contract, which assumed the type could always get smaller. Long phrases
   then ran off-screen, so `.ph` may wrap below 1024px. (Scoping this to 760px
   first left a gap: at 768px the beat rendered 814px wide in a 768px viewport.)

5. **Hero background stretch** (`vendor/hero-balloon.js`). `fitBg()` scaled the
   plane to the viewport aspect while the texture kept the photo's own aspect, so
   the crew shot distorted on resize — and since the glass glyph refracts that
   plane, the glyph looked squished too. Now crops cover-style via texture
   repeat/offset, recomputed on resize and on texture load.

6. **URL-bar scroll jump.** dvh on `.card` plus a width-vs-height guard on the
   resize listener were NOT enough: a height-only change still fired one refresh,
   because ScrollTrigger auto-refreshes on resize by itself. Dropped `resize` from
   its `autoRefreshEvents`. Measured height-only refreshes 1 -> 0; a real width
   change still refreshes, so rotation still works.

7. **Shader budget.** 13 always-on WebGL canvases on a phone. Added
   IntersectionObserver + Page Visibility pausing, a 30fps gate for the decorative
   shaders, and a DPR ceiling — via ShaderMount's `maxPixelCount`, because its
   `minPixelRatio` is a FLOOR, not a cap. All tunable via `window.GFX`, not
   hard-disabled, per the brief ("keep it configurable").

## Verified

- 0 horizontal overflow at 320 / 390 / 430 / 600 / 768 / 834 / 1024 / 1280 / 1440.
- 0 clipped text nodes at 390px; nothing under 12px except `.mrole` (deliberate).
- Full-page scroll sweep at 390px: 31 samples, 0 blank frames.
- Desktop + tablet unchanged: reel stays `row`, artist wall 3/4/5-up, hero scales
  42 -> 65px.

## Deliberately NOT changed

- **The chart's missing quadrant labels.** I first read this as broken, but the
  markup says the alien mark "replaces the old 2x2 labels" — that was an earlier
  deliberate decision, not a mobile regression.
- **Culturist Network image rotation.** Out of scope by instruction. The "1/3 with
  2 ticks" reading was just lazy-loading mid-flight, not a defect.
- The parked curly arrow (`.fb-curl{display:none}`).

## Still unverified

- **Real iOS Safari.** Everything here was measured in Chrome on macOS. The
  URL-bar fix in particular is the kind that deserves a real-device check.
- Real touch scrolling / momentum through the deck (Lenis + pin interaction).
