# CMS + Launch plan — 2026-07-23

Goal: operators edit ALL copy, reorder sections (hero/footer fixed), and add items
to lists (artists, IPs, offerings, brigade) through a simple UI. Site stays a
static, fast, hand-tuned page. Contractor hands off with zero ongoing management.

Stack decision: **Sveltia CMS + Eleventy build + Vercel** (client-owned account,
GitHub auth — no CMS vendor account, no database, no server).

## Architecture

Today: one 160KB hand-written `index.html`, everything inline.

Target:
```
content/
  settings.json        # section order (drag-to-reorder in CMS), site meta
  hero.json            # copy fields per section
  manifesto.json
  offerings.json       # list: items with title/copy/images[]
  artists.json         # list
  filmstrip.json       # list of 4 panels
  brigade.json         # list of members
  ...
src/
  index.njk            # page shell: hero + {% for s in order %} include + footer
  sections/*.njk       # one partial per section, markup moved verbatim
  css/, js/            # inline blocks extracted as-is (still inlined at build)
admin/
  index.html           # Sveltia CMS (one script tag)
  config.yml           # collections → forms, list widgets, image uploads
api/oauth.js           # tiny GitHub OAuth handler (Vercel serverless) for CMS login
.eleventy.js           # stitch + inline + minify → _site/index.html
```

Key invariant: **build output is byte-equivalent to today's page** (modulo
minification). The section JS (GSAP triggers) is per-element, so reordering
sections is safe; verify with a scroll sweep after Phase 3.

Every CMS save = a git commit → Vercel rebuilds → live in ~30s. Full history,
one-click rollback via git.

## Phases

1. **Prove the pipeline.** Eleventy scaffold; extract ONE section (offerings —
   it has copy + a list + images) into partial + JSON. Diff built output against
   current index.html; must be identical.
2. **Extract everything.** All sections → partials, all copy/lists → JSON.
   Hero + footer become fixed partials outside the order array. Re-verify
   byte-equivalence, then full 320–1440px sweep (reuse iframe-probe method).
3. **Reordering.** `settings.json: sections:[...]` drives include order. Test a
   few permutations: pinning, reveal observers, nav anchors all still work.
4. **CMS.** Sveltia at `/admin`, `config.yml` for every collection: text/rich
   fields for copy, list widgets (add/remove/drag) for artists/IPs/offerings/
   brigade/filmstrip, image widget uploading to `assets/`. GitHub OAuth via the
   Vercel function. Operators = repo collaborators.
5. **Prod pass.**
   - Minify HTML/CSS/JS at build (html-minifier-terser + esbuild).
   - Images: recompress banana.webp (788K), blur.webp (696K), nirvair-2 (640K),
     arcade.webp (516K) → target <250K each; add explicit width/height +
     `loading="lazy"` below the fold where missing.
   - 3D model: `cmf-hunyuan-uv.glb` 1.7MB → meshopt/Draco compress (~3–5x).
   - Meta: title/description, OG + Twitter card image, favicon set (exists),
     canonical, robots.txt, sitemap, 404 page.
   - vercel.json: immutable cache headers for /assets + /vendor.
6. **Handoff.** Repo transferred to client GitHub org; Vercel project on client
   account (flag: Hobby tier is non-commercial — they need Pro, $20/mo);
   1-page operator guide (how to log in, edit, add an artist, reorder, roll back).

## Risks / notes

- Phase 2 is the bulk of the work: careful surgery, mitigated by the
  byte-equivalence check per section.
- Sveltia's GitHub OAuth needs the small `api/oauth.js` function (Vercel has no
  built-in OAuth like Netlify) — ~40 lines, well-trodden.
- Rich-text in copy: fields that contain `.mark` highlights / line breaks will be
  constrained CMS widgets (string + a "highlight" sub-field pattern), not free
  HTML, so operators can't break the shader markup.
- Lab files (`*-lab.html`, README) excluded from build output.

## Status — 2026-07-24

Done (branch feature/cms-build):
- Hero: single signature statement, CRT-typed, no pin (operator-editable via hero.json).
- Phases 1–4 complete: build pipeline (byte-identical check), all 12 content
  files extracted, section reordering proven, nav theming made attribute-driven
  (data-navclear/data-nograin), Sveltia admin covering every content file,
  Vercel OAuth endpoints, vercel.json.
- Prod pass: collage images -750KB (q82, PSNR 39-41dB), balloon GLB 1.78->1.03MB
  (KHR_mesh_quantization, natively decoded by bundled GLTFLoader).
- Deliberately skipped: HTML/JS minification (Vercel brotli covers most of it;
  whitespace-collapse risk on hand-tuned inline CSS/JS not worth ~30KB).
- docs/OPERATORS.md written.

Remaining to launch (needs client/contractor accounts, not code):
1. Vercel project on client account: import repo, build auto-detected from
   vercel.json. Hobby tier is non-commercial — client needs Pro.
2. GitHub OAuth App (Settings > Developer settings): callback URL
   https://<domain>/api/callback; set GITHUB_CLIENT_ID/SECRET env vars in Vercel.
3. Set base_url in admin/config.yml to the deployed origin (currently commented).
4. Invite operators as repo collaborators.
5. On-device verification: hero balloon (quantized GLB), collage images
   (recompressed), single-statement hero typing, one full scroll on phone.
