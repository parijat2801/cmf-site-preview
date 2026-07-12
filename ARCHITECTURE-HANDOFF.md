# CMF Prototype — Session Handoff

**Status:** the full build spec in `crt-editorial-rebuild.md` §3 is implemented, plus several
client-requested additions made during live review. The user (Parijat) has been reviewing on
localhost and steering; treat this doc + that plan as the context pack.
**Branch:** `feature/responsive-breakpoints`. The real Next.js site is UNTOUCHED — everything
lives in the self-contained prototype.

## 1. Where things live

- **`prototype/` (repo root, canonical)** — the whole prototype, self-contained & offline-capable:
  `deck.html` (source of truth) = `index.html` (identical copy), `assets/` (webp images, grain
  tile, 33KB hero mascot), `fonts/` (NHG ttf), `vendor/` (gsap, ScrollTrigger, lenis, pretext).
  Earlier sessions kept this in the session scratchpad under /tmp — those paths are dead;
  the repo copy is now the only one that matters.
- **Serve:** `cd prototype && python3 -m http.server 4711` → http://localhost:4711/. Must be
  http (the script is an ES module importing `./vendor/pretext.esm.js`); `file://` fails.
- **Sync convention:** edit `deck.html`, then `cp deck.html index.html`. No src re-pointing
  needed anymore (all script srcs are already `vendor/…` relative).
- **Brand source of truth:** `cmf-site/public/assets/brand.css`. All colors in deck.html match it.
- Watch for stale `python -m http.server` processes squatting ports and serving old copies
  (bit us twice). `lsof -ti:4711` before assuming your changes "didn't work" — also the browser
  caches index.html; hard-refresh (Cmd+Shift+R) or bump a `?v=` query.

## 2. Page anatomy (in order)

| # | Section | id | Field | Accent | data-attrs |
|---|---------|----|-------|--------|------------|
| — | Hero (CRT power-on, balloon) | — | ink radial | red | `data-fit`, navbg #231F20 |
| 01 | Manifesto (thesis + 3 scrubbed beats) | `manifesto` | blue #084CA1 | white | `data-fit` |
| — | Quote (brand-book cover) | — | cream | red period + yellow mark | `data-fit`, nav `light` |
| 02 | Who we exist for (editorial index + hover peek) | `audience` | ink | yellow | `data-fit` |
| 03 | What we do (3 verticals, hover-cycle photos) | `offerings` | ink | red/yellow/green per pillar | tall |
| 04 | Work: Ruhbaru + Jupiter Pe Juice (hover-cycle) | `work` | red #DB1A21 | yellow mark | tall |
| 05 | The Misfits (photo wall + proof line) | `misfits` | ink | yellow | `data-fit` |
| 06 | Partner CTA (mailto hello@cmf.world) | `contact` | ink | pink (the ONE spectrum moment) | `data-fit` |
| — | Footer (memo signup, socials, credits) | — | #1B1818 | pink button | never pinned |

Verticals inside offerings have their own anchor ids: `culturist-network`, `irl-live`,
`film-studio` — these are the 3 nav links (plus Contact pill). #manifesto/#work ids still exist
but aren't in the nav.

## 3. Systems (all in deck.html's single `<script type="module">`)

- **Scroll engine** — GSAP ScrollTrigger pins with `pinSpacing:false` + explicit `.spacer` divs
  between cards = the cover-deck ("covered stays put") with authored dwell. Per card:
  *hold* mode (≤100vh: pin `top top`) or *tall* mode (>100vh: scrolls through its content first,
  pins `bottom bottom`). Pin end = dwell + cover distance (own height for hold, 1vh for tall) —
  don't "simplify" this back to `vh`, it causes an unpin pop. Dwell comes from **pretext** text
  measurement (line counts of `[data-m]` blocks); manifesto gets 3×90vh for its beat scrub
  (with snap), ×0.6 under 861px via `gsap.matchMedia`. Everything recomputes on
  `refreshInit` + debounced resize. `prefers-reduced-motion` → static stack, no Lenis/pins.
- **Fit system** — sections must FIT the window (client requirement). Two layers:
  (1) type/spacing tokens are `min(vw,vh)`-clamped in `:root`;
  (2) `[data-fit]` cards get `--fz` (fit factor) computed iteratively at refresh until
  `offsetHeight ≤ vh`, floor 0.72, else the card falls back to tall mode. Display sizes are
  written as `calc(<clamp> * var(--fz))`. NOTE: `--fz` shrinks fonts/paddings, NOT width-driven
  boxes — that's why the misfits cells are height-driven (`22vh`), a width-driven grid can't fit.
- **Nav** — solid bar wearing the current card's field color (`data-navbg`), text ink/white via
  `data-nav="light|dark"`, flipped by per-card ScrollTriggers at `top 90px`; auto-hides on
  scroll-down via the Lenis scroll event. Anchor clicks route through `anchorTargets` (pin-aware
  positions — a pinned card's live rect is NOT its scroll destination).
- **Reveals** — `.reveal` fade/rise via IO (threshold .15) + a throttled scroll **sweep** that
  force-fires anything scrolled past — fast flights skip IO windows; the sweep is the guarantee.
- **Hover peek** — one fixed `#apeek` figure (outside the deck: cards use `contain:paint` +
  get pinned, either hijacks position:fixed). Any `.peekzone` container with `[data-photo]`
  items gets: lerped cursor-trailing photo + optional `data-name` caption. Delegated
  `pointerover` (works for the modal's dynamic grid), hides on zone leave AND on >80px scroll
  (photos must not outlive their row). Touch: audience rows become an accordion instead.
- **Hover-cycle photo stacks** — `.oshot[data-photos]` (offerings + work): pointerenter →
  instant next + 900ms interval with tick progress bar; click advances on touch; imgs lazy-built
  when the row nears viewport. Images insert with `insertBefore(firstChild)` so DOM order is
  reversed vs logical — don't be confused by index checks.
- **Vertical modal** — `VERTICALS` config object (copy, kick, accent, 6 photos each); "Read
  more ↗" opens a takeover panel (accent-colored title + kick subline + body + misfits-style
  grid, which is also a peekzone). Close: button / scrim / Esc. Locks scroll via `lenisRef.stop()`
  + `overflow:hidden`. Header deliberately has NO hairline/numerals (client cut them).
- **CRT hero** — power-on flash + clip-open, scanlines at .3, roll on transform, glow settles to
  a single soft shadow after the mega's rise animation ends (`.settled`). Balloon inflates then
  recedes to dim bg. Grain = pre-baked `assets/grain.png` tile (no SVG turbulence).

## 4. Placeholder content that needs the CLIENT before production

1. **Misfits roster** — all 8 names are fictional (Zoya Firaq, Baawra Collective, …); photos
   reuse event shots. Real artists + portraits needed.
2. **Proof line** — "32 artists · 11 sold-out rooms · 2 cities" is invented.
3. **Modal copy** — written in-voice by us; client should bless. "First dispatch: late 2026" is
   the plan-mandated replacement for "coming soon" — keep a dated commitment.
4. Footer socials: only Instagram is real (instagram.com/culturalmisfits); email hello@cmf.world
   is real (from `content/page/home.json`).

## 5. Testing gotchas (cost us real time)

- **Claude-in-Chrome on an occluded window**: Chrome freezes rAF, scroll events, ScrollTrigger
  updates and lazy-loading while the window is hidden — pages LOOK broken in screenshots
  (blank reveals, dead anchors) when they're fine. Verify with DOM-state JS checks, or have the
  user bring the window frontmost. Do NOT chase these ghosts again.
- No Playwright loops — the user reviews visually; tell them exactly what to check.

## 6. The port (next major step — only after sign-off)

Per plan §5: copy → `cmf-site/content/page/home.json` via Tina (NEVER hardcode copy — misfit
roster, vertical modal content, proof stats, audience rows all become Tina list fields), styles →
`globals.css`, choreography → `motion.ts` (it already uses the same Lenis+ScrollTrigger wiring;
mirror the pin/dwell/fit logic), components → `LandingClient.tsx`. `cd cmf-site && npm run build`
must exit 0 before any commit. Keep the prototype around until parity is confirmed.

## 7. Definition-of-done status (original 6 client issues)

All six fixed in the prototype: nav overlap (solid themed bar), art-directed copy, hover-cycle
offerings, brand-accurate colors, illustrations removed (editorial index), perf pass (webp,
baked grain, transform-only animations, lazy images). Cursor cut, highlighter legible pre/post
sweep, CRT refined, partner CTA present, memo demoted to footer. Added beyond plan: Misfits
roster wall, verticals-as-nav, vertical detail modals, fit-to-window system.
