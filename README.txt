CMF — landing page
------------------
Single-page site (index.html). ES modules need HTTP (file:// won't work):

  python3 -m http.server 4711   →   http://localhost:4711/

Everything is vendored (no build step, no network deps):
  fonts/                 Neue Haas Grotesk
  assets/                images (webp/jpg/mp4), grain, brand marks
  vendor/                gsap, ScrollTrigger, lenis, pretext, three.js + loaders
  vendor/hero-balloon.js the 3D hero balloon (see docs/HERO-BALLOON.md)
  assets/brand/cmf-hunyuan-uv.glb   the 3D CMF-glyph balloon mesh
