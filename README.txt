CMF — CRT editorial prototype (rebuilt)
---------------------------------------
Serve it (ES modules need http, file:// won't work):
  cd prototype && python3 -m http.server 4711  →  http://localhost:4711/

deck.html is the working source of truth; index.html is an identical copy
(kept so "open index.html" muscle memory works). Everything is vendored:
fonts, images (webp), gsap/ScrollTrigger/lenis/pretext in vendor/.

This is a design-direction prototype, NOT the production site.
Copy/photos/roster names are placeholder-real; CMS + port come later.
See docs/plans/crt-editorial-handoff.md for the full architecture handoff.
