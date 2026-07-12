# CMF Website Prototype — Handoff

This is the **Cultural Misfits (CMF)** website prototype: a CRT-editorial scroll experience.
It's a **design-direction prototype**, self-contained and offline-capable. No build step, no
npm install, no CMS — just static HTML + vendored JS/fonts/images.

---

## Claude: start here

You're picking up this prototype to continue design work. Read these two files first, in order:

1. **`ARCHITECTURE-HANDOFF.md`** — full architecture, what's implemented, conventions, gotchas.
2. **`README.txt`** — the original short serve-it note.

Then serve and open it (see below) before touching anything.

## Run it (must be over http — `file://` breaks the ES modules)

```bash
cd prototype
python3 -m http.server 4711
# → open http://localhost:4711/
```

## The one convention that matters

`deck.html` is the **source of truth**. `index.html` is an identical copy kept so
"open index.html" works. **After editing `deck.html`, sync it:**

```bash
cp deck.html index.html
```

All script `src`s are already relative (`vendor/…`), so nothing else needs re-pointing.

## What's in this folder

| Path | What it is |
|------|-----------|
| `deck.html` | The prototype — **edit this one** |
| `index.html` | Identical copy of `deck.html` (keep in sync) |
| `assets/` | webp photos, grain tile, hero mascot |
| `fonts/` | Neue Haas Grotesk (`.ttf`) |
| `vendor/` | gsap, ScrollTrigger, lenis, pretext (all vendored, offline) |
| `ARCHITECTURE-HANDOFF.md` | Full context pack — read this |
| `README.txt` | Original serve note |

## Notes for the designer

- Copy, photos, and roster names are **placeholder-real** — treat as design filler, not final.
- Brand colors mirror `cmf-site/public/assets/brand.css` from the main repo (not included here);
  keep them consistent if you change palette.
- This prototype is **decoupled from the production Next.js site** — changes here don't touch it.
