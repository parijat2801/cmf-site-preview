# CMF Website Prototype — Handoff (cmf-site-v2)

This is the **Cultural Misfits (CMF)** website prototype: a CRT-editorial scroll experience.
It's a **design-direction prototype**, self-contained and offline-capable. No build step, no
`npm install`, no CMS — just static HTML + vendored JS / fonts / images.

---

## Claude: start here

You're picking this up to continue design work with the designer. Do this in order:

1. **Serve and open it** (below) before touching anything — see the live page first.
2. Read **`ARCHITECTURE-HANDOFF.md`** for the full architecture, systems, and gotchas.
3. Then read the convention + gotchas in this file before editing.

## Run it (must be over http — `file://` breaks the ES modules)

From the **repo root** (the folder that contains `deck.html`):

```bash
python3 -m http.server 4711
# → open http://localhost:4711/
```

That's it — no install step. The page loads GSAP, ScrollTrigger, Lenis, and pretext from
the local `vendor/` folder, so it works fully offline.

> If port 4711 is busy, use any port: `python3 -m http.server 8000` → `http://localhost:8000/`.

## The one convention that matters

`deck.html` is the **source of truth**. `index.html` is an identical copy kept so
"open index.html" muscle-memory works. **After every edit to `deck.html`, sync it:**

```bash
cp deck.html index.html
```

All script/asset paths are already relative, so nothing else needs re-pointing.

## Gotchas that will waste your time if you don't know them

- **Browser caches hard.** After editing, a normal reload may show the OLD page (or an old
  video). Hard-refresh with **Cmd+Shift+R** (Mac) / **Ctrl+Shift+R**, or add a throwaway
  query like `http://localhost:4711/?v=2`. Same-named asset swaps (e.g. replacing a video)
  especially need this — bump a `?v=` on the asset URL in `deck.html`.
- **Stale servers.** If changes "don't show up," check nothing old is squatting the port:
  `lsof -ti:4711` — kill strays before assuming your edit failed.
- **Reduced motion.** With OS "reduce motion" on, all the pinned scroll scenes fall back to a
  static stack (by design). Test with it off to see the intended choreography.

## What's in this folder

| Path | What it is |
|------|-----------|
| `deck.html` | The prototype — **edit this one** |
| `index.html` | Identical copy of `deck.html` (keep in sync via `cp`) |
| `assets/` | photos (webp/jpg), background videos (mp4), the inline nav logo (svg/) |
| `fonts/` | Neue Haas Grotesk Display (`.ttf`) |
| `vendor/` | gsap, ScrollTrigger, lenis, pretext (all vendored, offline) |
| `ARCHITECTURE-HANDOFF.md` | Full context pack — read this second |
| `README.txt` | Original short serve note |

## Section order (top to bottom)

Hero → Manifesto → Quote → Audience ("who we exist for") → Offerings ("what we do") →
Work → Misfits roster → Partner CTA → Footer.

## Recent changes in this session (context for what's fresh)

- **Hero** — background video (`assets/hero-bg.mp4`) with the CRT scanline effect over it;
  the word "culture" gets a hand-drawn red ellipse ring and stays on the first line;
  the navbar is transparent over the hero; the nav wordmark is the designer's logo, inlined
  as SVG so it recolors with the nav theme (white on dark cards, ink on light).
- **Manifesto** — the flat blue field was replaced with the designer's photo
  (`assets/manifesto-still.jpg`), natural brightness, ink text, with the second sentence
  ("Culture happens in the margins") in white. The three beats have their 01/02/03 numbers
  removed; a single continuous top line **draws left→right as you scroll** across all three
  beats; there's a reading dwell after the last beat lands. Grain is suppressed over this
  section so the photo reads clean.
- **Quote** ("A sanctuary and catalyst…") — the designer's `assets/quote-bg.mp4` plays behind
  it in **black & white**, under a dark scrim, with white text and the CRT overlay. The
  highlighter sweep is on "sanctuary and catalyst".

## Notes for the designer

- Copy, photos, and roster names are **placeholder-real** — treat as design filler, not final.
- The two background videos (`hero-bg.mp4`, `quote-bg.mp4`) are the heaviest assets (~6MB each).
- This prototype is **decoupled from the production Next.js site** — changes here don't touch it.
- Brand palette lives in the `:root` block at the top of `deck.html` (`--red`, `--yellow`,
  `--blue`, `--ink`, `--cream`, etc.). Keep new colors consistent with those.
