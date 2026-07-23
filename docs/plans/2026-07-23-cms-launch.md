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

## Hardening pass — 2026-07-24 (so the client doesn't call)

Implemented, with failing-case proofs where possible:
- CMS bundle SELF-HOSTED + PINNED (admin/sveltia-cms.js, v0.172.4 via npm devDep).
  No floating CDN "latest" — upstream beta regressions can't brick the panel.
- Upload pipeline (config media_libraries): auto-WebP q85, max 1800px, 5MB cap,
  slugified filenames (spaces/commas would break data-photos + URLs).
- Build validation wall (every CMS save; failed build = previous deploy stays
  live on Vercel): empty required fields, list minimums, unknown/duplicate
  section slugs, <script> in content, comma/quote in asset paths, referenced
  image missing, referenced image >1.5MB, and a whole-page scan that protects
  site-critical assets content JSON never mentions (balloon GLB, poster,
  matcaps, grain) from media-library deletion. Proofs: emptied hero line,
  broken image ref, deleted GLB — all refused with readable errors.
- VERTICALS JSON serialization <-escaped: no content string can terminate the
  script block.
- engines.node >=20; @gltf-transform/cli removed from devDeps (one-time tool).

Known unknowns — resolve at/after deploy, in order:
1. OAuth round-trip: only provable on the real domain (OAuth app + env vars).
   Test on a Vercel preview deploy BEFORE DNS.
2. Branch protection: if the client org requires PRs on main, CMS commits are
   blocked. Either exempt the operators' pushes or point the CMS at a content
   branch with auto-merge. Ask the client's GitHub admin.
3. Failed-build visibility: Vercel emails the project owner, not the operator
   who saved. Decide who watches (owner email alias? Slack integration?).
4. Repo transfer to client org: OAuth app callback URL, config.yml repo:,
   collaborator invites all change together. Do in one sitting.
5. Quantized GLB + recompressed collage images: verified in code, needs one
   on-device eyeball.
6. Sveltia media_libraries transformations: config follows current docs;
   verify the first real upload converts to webp as expected.
7. Concurrent editors: git-backed saves are last-write-wins per file. With 2+
   simultaneous operators editing the SAME panel, later save wins. Small team
   + section-per-file layout makes this rare; mention in operator onboarding.

## Security review — 2026-07-24

Fixed: OAuth callback posted the GitHub token via postMessage('*') — any site
opening our popup could have captured a returning operator's token (GitHub
re-approves known apps silently). Now pinned both ways to OAUTH_ALLOWED_ORIGIN
(NEW REQUIRED Vercel env var = the site origin, e.g. https://cmf-site.vercel.app;
callback 500s without it). OAuth scope reduced to public_repo,user (least
privilege while the repo is public; set GITHUB_OAUTH_SCOPE=repo,user if it goes
private). Headers: X-Frame-Options DENY on /admin (clickjacking), nosniff global.

Accepted residual risk (trusted-operator model): content fields are HTML-capable
by design (highlight spans), so anyone with repo Write can inject markup — same
privilege git already grants them; the <script> validator block prevents
accidents, not insiders. Operator GitHub tokens live in their browser storage
(standard for this CMS class); revoke by removing repo access.
