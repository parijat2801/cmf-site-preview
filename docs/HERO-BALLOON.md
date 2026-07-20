# Hero balloon — how it works

The hero shows a 3D red **latex balloon** of the CMF logomark (the ⚵-style glyph),
rendered on a WebGL canvas layered under the CRT overlay + headline. It replaced an
AI-generated background video.

## Files
- `vendor/hero-balloon.js` — the whole thing: loads the mesh, lights it, animates it.
- `assets/brand/cmf-hunyuan-uv.glb` — the balloon mesh (shipped, render-ready).
- `assets/brand/balloon-glyph-1k.png` — poster fallback (shown only if WebGL/model fails).
- `vendor/{three.module.min.js, GLTFLoader.js, BufferGeometryUtils.js, RoomEnvironment.js}`
  — vendored three.js r160 + addons. Bare `from 'three'` imports were rewritten to
  `./three.module.min.js`; GLTFLoader's `../utils/BufferGeometryUtils.js` → `./BufferGeometryUtils.js`.
- `index.html` — swaps a `<video>` for `<canvas id="heroCanvas">`, inits the module in
  isolation (a WebGL/model failure can't take down the hero), and reveals the poster
  only on `balloonfailed`.

## The mesh
Made via image-to-3D (Hunyuan3D) from `balloon-red.png`, then made render-ready:
- **smooth vertex normals + a UV unwrap** (xatlas) — the raw export had NEITHER, which
  silently broke every texture/normal map (a normalMap with no UVs samples one texel and
  darkens the whole surface).
- **Taubin smoothing** (volume-preserving) to remove the sculpt's low-frequency lumps.

The prep script is not shipped (it was a one-off). To regenerate from a new sculpt:
`trimesh` + `xatlas` + `scipy` + `Pillow`; compute `mesh.vertex_normals`,
`trimesh.smoothing.filter_taubin(mesh, lamb=0.5, nu=0.53, iterations=12)`,
`xatlas.parametrize(...)`, attach uv via `TextureVisuals`, export glb.

## Material — it's LATEX, not metal
The single most important lesson: **a balloon is a dielectric (latex/mylar), not a metal.**
A metallic material produces sharp, patchy highlights that read as *dents*. The correct
recipe (`MeshPhysicalMaterial`):
- `metalness: 0`
- `roughness ~0.18` → one broad, smooth, continuous highlight
- `sheen: 1` + warm `sheenColor` → the soft inflated-latex rim halo
- `transmission ~0.18` + `thickness` + `ior 1.45` → subtle light-through-latex
- `clearcoat: 1` → wet glossy top coat
- red `emissive` at low intensity → keeps the red vivid in the dark hero

## Lighting
- Environment = `PMREMGenerator.fromScene(new RoomEnvironment(renderer), 0.04)`.
  **`RoomEnvironment` MUST be constructed with the renderer** in r160 — without it the
  PMREM bakes weak legacy-intensity lighting and the surface renders as a black
  silhouette (exposure then only flips between black and grey-wash).
- Plus two DirectionalLights + a HemisphereLight (ground colour = hero ink `#231F20`).

## Reflections
A `CubeCamera` at the balloon captures an in-scene backdrop plane that carries the hero
headline copy (the WebGL canvas sits over the DOM, so the real text can't be seen — it's
recreated on a plane the cube camera can). Fed as the material's `envMap` so the headline
mirrors across the foil. Cube updates every other frame; the balloon hides itself during
capture so it doesn't reflect itself.

## Animation
Slow bob + lazy sway + turn-toward-pointer + nod-on-scroll (all sine-driven), pauses via
IntersectionObserver when off-screen, and honours `prefers-reduced-motion`.

## Known follow-ups
- The site-wide film grain (`body::after`, `assets/grain.png`, opacity 0.05) sits over the
  balloon too; on the bright red it can read as faint crosshatch. Left as-is (it's the
  site's texture); mask it off the canvas area if it bothers you.
- Reflection is 512px, updates at ~30fps. Bump for a sharper mirror at some GPU cost.
