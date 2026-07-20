# CMF Site — Handoff Notes

Working notes for whoever picks this up next. Read before editing `index.html`.

## What this is
A single-file static site: `index.html` (all HTML + CSS + JS inline) + `assets/`, `fonts/`, `vendor/`. No build step, no package.json. Just serve the folder.

- **Run locally:** `cd /Users/parijat/dev/cmf-site-v2 && python3 -m http.server 4800` → http://localhost:4800/index.html
- **Live preview:** https://parijat2801.github.io/cmf-site-preview/ (GitHub Pages, serves `main` root).
- **Deploy = just push `main`:** `git push origin main`; Pages auto-rebuilds in ~1–3 min. Everything (local main, origin, live) is currently in sync at whatever `git log -1` shows.

## Repo / git layout (IMPORTANT — this bit is unusual)
- `main` IS the finished, current site. The old `main` base was fast-forwarded to the collage/manifesto work, so `main` = latest.
- Historical branches (`feature/manifesto-collage`, `feature/copy-refresh`, `fix/design-feedback-round`, etc.) are all BEHIND `main` — they're sources already folded in. Don't merge them into main; main is ahead of everything.
- There used to be **git worktrees checked out under `/private/tmp/.../scratchpad/`** (copy-refresh, manifesto-port). Those are stale — do NOT edit them. Edit `/Users/parijat/dev/cmf-site-v2` directly. (A common trap earlier: a `python3 -m http.server` was left rooted in a tmp worktree, so edits to the real repo didn't show. Always confirm which dir your server is serving.)
- `origin` = https://github.com/parijat2801/cmf-site-preview.git (public repo, free Pages requires public).
- **`git push` gets blocked by the sandbox classifier for the agent.** If a push is denied, either the user runs it with a `! ...` prefixed command, or they add a Bash permission rule. `gh api` calls (e.g. enabling Pages, checking build status) are allowed.

## Page structure / section order (top to bottom)
Hero → **Manifesto collage** → Brigade ("Our Artists") → Offerings ("How we bring these narratives to you.") → Acts ("The Misfits Acts.") → **Brands (For Brands)** → **Calling Everybody ("We work with")** → Partner CTA → Footer.

## The animation/layout systems (know these before touching motion)
The site uses **GSAP + ScrollTrigger + Lenis** (vendored in `vendor/`).

- **The deck pin system:** `cards = gsap.utils.toArray('.deck > .card')`. Every `.deck > .card` section gets pinned for a computed "dwell", with a `.spacer` div inserted after it. Sections that are NOT `.card` (the manifesto ones) are excluded and just scroll.
- **Per-section dwell** is computed in `computeAll()`; there are special-cases keyed off class: `hero` (short), `for-brands` (long — held so the chart choreography can't be scrolled past). Add a special-case there if a section needs a longer/shorter pin.
- **Nav theme:** each `<section>` needs `data-nav="dark|light"` + `data-navbg="#hex"`; the nav bar recolors to the current section's field as it scrolls under.
- **Reveal-on-scroll:** elements with class `reveal` (+ `data-m`) get `.in` added by an IntersectionObserver → CSS transitions fire. Stagger with `d1`…`d5` (transition-delay). This observer is **once-only** (`io.unobserve` after firing).
  - **EXCEPTION:** the entire `#for-brands` section REPLAYS. A dedicated observer toggles `.in` on all its reveals on enter/exit, so its narrative re-runs every time. All `#for-brands` reveals are filtered OUT of the once-only set. If you add a reveal inside `#for-brands`, it'll be part of the replay automatically.

## Class-naming (collision hazard)
- The deck uses generic classes `.card`, `.beat`, `.mark`, `.ph`, `.head`, `.reveal`.
- The **manifesto collage** classes are all `mf-` prefixed (`.mf-collage`, `.mf-beat`, `.mf-card`, `.mf-ph`, `.mf-reel`, etc.) specifically to avoid clobbering the deck's `.card`/`.beat`/`.ph`. If you port any new component in, prefix its classes — do NOT reuse `.card`/`.beat`/`.ph` bare.
- Brands chart classes are `.fb-*`; "We work with" classes are `.ww-*`.

## Type scale — MUST use the dual-axis tokens
Sizes must use `--t-label/--t-body/--t-lead/--t-head` (all `clamp(min, min(Xvw, Yvh), max)`) OR the same `min(vw,vh)` pattern. **Never `vw`-only clamps** — they scale inconsistently vs. the rest of the site (this was a real bug that got fixed across the manifesto). Deck `.card` text is additionally multiplied by `var(--fz)` (a JS fit-scale for one-screen cards); non-card sections don't get `--fz`.

## The `.mark` highlight
`<span class="mark" style="--hl:var(--COLOR)">word</span>` draws a colored highlight behind the word; on reveal the TEXT turns ink (dark). Add class `mark-w` to keep the text light (cream) instead — used for red highlights on dark fields (Brigade, narratives, Made Real, the Brands email). On the RED Acts section, "Acts." uses `--hl:var(--cream)` with plain `.mark` (dark text on cream). Match these conventions for consistency.

## Hero specifics
- Background is `assets/quote-bg.mp4` (the balloon video), forced **grayscale** via CSS, with the CRT `.tv` overlay (scan/roll/glass) on top. Playback is slowed to **0.5×** in JS so it lasts through the text animation.
- **CRT power-on plays ONCE.** GSAP re-pinning the hero (on refresh/resize) re-inserts `.content` and would replay the `power`/`open` CSS animations = repeated blinks. Fixed by killing those animations once `.hero.settled` (see `.hero.settled .content/.flash` rules). If you touch the hero pin, keep that guard.
- Hero beats are a per-glyph typewriter (each char wrapped in `.g`, lit progressively) with idle auto-advance + kill-on-real-scroll. It's intricate; the single-source-of-truth render model was hard-won — don't casually refactor it.

## Brands chart (the choreographed 2×2)
- Rebuilt in the site's language (NOT the client's graph-paper doodle). Axes are scalable `.fb-axis` divs (not borders) so they can "draw"; arrowheads are CSS triangles; the balloon logomark (`assets/brand/balloon-red.png`) marks the top-right target; midlines are `.fb-plot::before/::after`.
- Choreography is pure CSS transition-delays gated on `.fb-chart.in`: Y draws → X draws → arrowheads → midlines → balloon pops → callout scales in (the emphasis beat) → copy last. To retune timing, edit the delay numbers (search `.fb-axis`, `.fb-target`, `.fb-copy.reveal`). The section pins long enough (`for-brands` dwell) that a fast scroll can't skip it, and the whole section replays on re-entry.

## Assets worth knowing
- `assets/brigade/1–9.png` — the 9 artist photos (Brigade + reused in the manifesto reel). Roster is ordered by the `.mno` number (a load-time sort), so changing a cell's number moves it. `.mwall` is a **fixed 5-col grid** (was auto-fit → accidentally became 7; locked to 5, steps to 4/3/2 on narrower widths).
- `assets/collage/{blur,arcade,banana}.png` — the manifesto chant photos.
- `assets/brand/balloon-red.png` — the red balloon logomark (~3.5MB).
- `assets/favicon/` — the CMF favicon set (Option 1).
- **Weight caveat:** photos are unoptimized PNGs and there are two ~6.7MB videos + the 3.5MB balloon. Fine for preview; compress before any real launch.

## Known-open / TODO-ish
- Assets unoptimized (see above) — worth a compression pass pre-launch.
- Placeholder-ish: some social links point at generic `instagram.com/culturalmisfits`, etc.
- The old `assets/hero-bg.mp4` is now unused (hero uses quote-bg.mp4) but left in place.
- If a horizontal red seam ever reappears between the manifesto collage and the four-types stage, it's the red frame showing between two dark inset panels — check the collage bottom padding / the sticky stage top.

## Verify-before-done checklist
1. `python3 -c "import html.parser;html.parser.HTMLParser().feed(open('index.html').read());print('OK')"`
2. Serve from the REAL repo dir (not a tmp worktree) and check 200.
3. If you added CSS classes, grep that they don't collide with deck classes.
4. If you touched scroll/pin/reveal JS, re-read it — a stray selector to a removed element throws and can break all scroll behavior below it.
5. Commit; push `main`; `gh api .../pages/builds/latest --jq .status` until `built`; confirm live URL 200.
