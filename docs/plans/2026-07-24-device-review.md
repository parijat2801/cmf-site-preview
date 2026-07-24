# Device-review checklist — perf-device-tuning

Branch: `feature/perf-device-tuning`. Three independent performance commits, one
each, ordered for cherry-pick after on-device testing. Nothing here is pushed or
merged — this is a review branch. Each item below: what changed, the exact
on-device check, what failure looks like, and the URL overrides for A/B.

All three read/write the single `window.GFX` knob defined in `src/foot.njk`; the
root `index.html` and `dist/index.html` are build outputs of `node build.mjs` and
stay byte-identical.

---

## Commit 1 — Hero DPR: cap at 1.5 on touch devices

**What changed** (`src/foot.njk`): `GFX.maxDPR_hero` now resolves to `1.5` on
touch devices (`matchMedia('(hover:none) and (pointer:coarse)')` = phones +
tablets) and stays `2` on pointer devices (desktop). The hero glass material uses
`transmission`, which renders the scene twice per frame, so DPR is the dominant
hero GPU cost. `vendor/hero-balloon.js` reads `GFX.maxDPR_hero` once at module
load; antialias and the balloon internals are untouched.

**URL override:** `?heroDPR=<number>` — forces the hero DPR ceiling, wins over
the auto value. Reads once at module load, so **it needs a full page reload to
apply** (not live).

**On-device check** (tablet, e.g. iPad):
1. Load `?heroDPR=2`, look at the glass glyph's edges and reflections. Reload
   with `?heroDPR=1.5` and compare at normal viewing distance.
2. Scroll the whole page down then back up; confirm the hero is still the live 3D
   balloon (not the flat poster fallback).

**Failure looks like:** the glyph reads visibly soft / pixelated at 1.5 in a way
the client would reject (if 1.5 is indistinguishable at arm's length, ship it);
or the hero has dropped to the poster after scrolling (a context eviction — note
it, it points at the total-context problem Commit 3 addresses).

---

## Commit 2 — GFX tier 'auto' resolves: phones get LOD-15

**What changed** (`src/foot.njk` + `src/head.njk`): `GFX.tier:'auto'` (the
production default) now resolves to a concrete `'low'`/`'high'` before any
consumer reads it — `'low'` when `matchMedia('(max-width:860px)')` (phone width)
OR `prefers-reduced-motion`, else `'high'`. `hero-balloon.js` is unchanged: its
`LOW_TIER = (GFX.tier==='low') || saveData` composes, so `'auto'→'low'` and
save-data each independently force the smaller balloon mesh (LOD-15, 200KB vs
LOD-25, 310KB). The `<head>` GLB preload was updated to mirror the same signal
(it runs before `window.GFX` exists) so a phone preloads LOD-15 and doesn't
double-fetch the wrong LOD.

**Ship condition:** this makes ALL phones (≤860px) fetch LOD-15 instead of
LOD-25. The client previously approved LOD-25 on-phone visually — this commit
ships only if they accept LOD-15 in context. That is the point of the review.

**URL override:** `?tier=low|high` — forces the LOD tier, wins over
auto-resolution. Mirrored in the `<head>` preload too, so the preload and the
module agree. Reads once at module load → **reload to apply.**

**On-device check** (phone, iPhone + Android):
1. Load normally; confirm the balloon looks acceptable. Then compare `?tier=high`
   (fetches LOD-25) vs `?tier=low` (fetches LOD-15) on the SAME phone.
2. Open the Network panel (Safari Web Inspector / Chrome remote): confirm exactly
   ONE `balloon-lod*.glb` is fetched (LOD-15 on a phone), never both.

**Failure looks like:** the glyph reads noticeably lumpier / lower-poly at LOD-15
in a way the client rejects; or two GLB requests appear in the waterfall
(preload/module LOD mismatch — the `<head>` mirror is out of sync).

---

## Commit 3 — Highlighter shaders: lazy mount + dispose

**What changed** (`src/foot.njk`, highlighter module): highlighter ShaderMounts
are no longer all created at init. Each `.mark` mounts its WebGL context only as
it nears the viewport and disposes it once its stroke has completed AND it is far
off-screen. This drops the steady-state live-context count from up to 12 (≈10
marks + hero + crayon, none ever disposed) to roughly 5 (hero + crayon + a few
near-viewport marks), so iOS stops evicting the hero (the oldest context).

State machine (per mark): UNMOUNTED (no context) → MOUNTED drawing → MOUNTED
complete → disposed back to UNMOUNTED when far off-screen. Mount band =
`rootMargin 150%`; dispose band = `rootMargin 100%` (deliberately smaller, so
scroll-back re-mounts before the mark is visible). A re-mounted completed mark
renders at prog 1 immediately — the stroke never replays. Preserved: the 30fps
gate, `document.hidden` guard, demand-driven rAF, `webglcontextlost` → CSS
fallback, fonts/resize resync, and the reduced-motion path (module returns early,
nothing ever mounts).

**Visual-equivalence note:** a disposed mark has no canvas and its CSS `::before`
swipe is suppressed (`display:none` under `.mark-shader`), so with the canvas
gone the highlight is simply ABSENT — it is NOT swapped to the flat CSS bar,
because the textured shader stroke and the flat bar are not visually equivalent.
Disposal is therefore gated on the mark being well off-screen, where the absent
stroke can't be seen; the wider mount band restores it before it returns. On
screen a completed mark ALWAYS shows the real shader stroke.

**No URL override** (this is a structural change, not an A/B knob). To sanity-
check the OLD behavior, compare against a build from before this commit.

**On-device check** (iPhone + iPad, Safari):
1. Scroll the whole page top → bottom → top a few times.
2. The hero balloon must survive every pass (never drop to the poster).
3. Every highlighted word must show its textured marker stroke when on screen —
   both the first time and on scroll-back — with no flat-bar pop and no stroke
   replay on re-entry.
4. In Safari Web Inspector, watch the live WebGL context count: it should peak
   around 5, not 12.

**Failure looks like:** the hero going to poster; a highlight showing a flat
solid bar instead of the crayon stroke; a completed highlight briefly blank as
you scroll back to it (dispose/mount bands mis-ordered); or a stroke re-animating
from scratch on re-entry (re-mount replaying instead of rendering prog 1).

---

## Per-commit A/B override quick reference

| Item | Override | Effect | Live? |
|------|----------|--------|-------|
| Commit 1 | `?heroDPR=<n>` | hero DPR ceiling (e.g. `2`, `1.5`, `1`) | reload |
| Commit 2 | `?tier=low\|high` | force LOD-15 / LOD-25 | reload |
| Commit 3 | — | structural; compare against a pre-commit build | — |

Both overrides also work together, e.g. `?tier=high&heroDPR=2` reproduces the
old full-quality path on a phone for a side-by-side.
