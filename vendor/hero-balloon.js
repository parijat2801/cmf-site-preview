/* ============================================================================
   HERO BALLOON — the real sculpted 3D CMF-glyph foil balloon under the CRT hero.
   Replaces the old quote-bg.mp4.

   The mesh is a genuine image-to-3D sculpt (TRELLIS) of the brand foil logomark,
   cleaned of reconstruction artifacts, loaded here as a .glb. It's re-lit and
   rendered near-monochrome so it sits inside the existing B&W + CRT hero — the
   .tv scanline overlay and the headline beats stay on top exactly as before.
   It drifts, bobs, and parallaxes to pointer + scroll.

   Vendored Three.js + GLTFLoader. Degrades to the poster image if WebGL is off,
   the model fails to load, or the reader prefers reduced motion.
   ========================================================================== */
import * as THREE from './three.module.min.js';
import { GLTFLoader } from './GLTFLoader.js';
import { RoomEnvironment } from './RoomEnvironment.js';

/* Model weight tiers (design call 2026-07-24): the source sculpt spends its
   triangle budget inefficiently (TRELLIS image-to-3D, no retopology), so the
   quarter-resolution mesh is visually equivalent on the page. LOD-25 (310KB)
   is the default; LOD-15 (200KB) serves save-data / low-tier visitors. The
   full 1.03MB source stays in the repo (cmf-hunyuan-uv.glb) as the master for
   regenerating LODs — it is never fetched by the page. */
const LOW_TIER = (window.GFX?.tier === 'low') || !!navigator.connection?.saveData;
const MODEL = LOW_TIER ? 'assets/brand/balloon-lod15.glb'
                       : 'assets/brand/balloon-lod25.glb';

// DPR ceiling for this canvas — read from the page's single GFX knob (see the
// window.GFX block in index.html) so the hero balloon and the 2D shaders share
// one config surface; 2 is also the fallback if this module ever loads without
// it (e.g. a future standalone test page).
const MAX_DPR_HERO = window.GFX?.maxDPR_hero ?? 2;

export function initHeroBalloon(canvas) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: true, powerPreference: 'low-power',
    });
  } catch (e) { return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 8);

  // ---- environment: a real procedural studio (RoomEnvironment) baked to a
  //      PMREM cubemap. This is what makes a metallic/foil surface actually
  //      read as lit foil instead of a black silhouette — the metal now has a
  //      bright, wrapping studio to reflect. Plus two directional lights for
  //      crisp travelling highlights over the tubes. ------------------------
  // NOTE (root cause of the earlier black-silhouette bug): in r160 RoomEnvironment
  // must be constructed WITH the renderer, or its PMREM bakes at weak legacy light
  // intensities and the metal reflects a dull env — so exposure just flips between
  // "black metal" and "grey wash". Passing the renderer + compileCubemapShader()
  // gives a properly-bright studio to reflect. (Diagnosed via Codex/GPT-5.5.)
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const env = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = env;                       // bright RoomEnvironment PMREM (intensity ~900)

  const key  = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-4, 5, 6); scene.add(key);
  const rim  = new THREE.DirectionalLight(0xe8eeff, 1.6); rim.position.set(5, 2, 3);  scene.add(rim);
  const fill = new THREE.HemisphereLight(0xffffff, 0x231f20, 0.8); scene.add(fill);

  const pivot = new THREE.Group();
  scene.add(pivot);

  // ---- BACKGROUND IMAGE PLANE: a real visible plane behind the glass glyph. The
  //      glass material's `transmission` samples the scene rendered BEHIND it, so
  //      THIS plane is what the glass refracts/bends. Swap BG_IMAGE for any asset.
  const BG_IMAGE = 'assets/crew.webp';              // crew shot (red/black streetwear)
  let bgImgAspect = null;                           // set once the image loads (w/h)
  const bgTex = new THREE.TextureLoader().load(BG_IMAGE, (tex) => {
    // onLoad: now tex.image has real dimensions. Grab the image's own aspect so
    // fitBgUV() can crop like CSS `object-fit: cover` instead of stretching to
    // whatever shape the viewport happens to be.
    if (tex.image && tex.image.width && tex.image.height) {
      bgImgAspect = tex.image.width / tex.image.height;
    }
    fitBgUV();                                      // recompute crop now that we know it
  });
  bgTex.colorSpace = THREE.SRGBColorSpace;
  // ClampToEdge (not the default Repeat) so a repeat<1 crop shows a single
  // centered slice of the image instead of tiling at the edges.
  bgTex.wrapS = bgTex.wrapT = THREE.ClampToEdgeWrapping;
  const bgPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: bgTex, toneMapped: false })
  );
  bgPlane.position.set(0, 0, -3);                 // behind the glyph, faces the camera
  scene.add(bgPlane);
  // size the bg plane to cover the view at its depth (updated in fit())
  function fitBg() {
    const dist = camera.position.z - bgPlane.position.z;
    const vH = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * dist;
    const vW = vH * camera.aspect;
    bgPlane.scale.set(vW, vH, 1);
  }
  // CSS `object-fit: cover` for the bg texture: the plane itself still stretches
  // to fill the viewport (fitBg above — that's fine, it's an untextured quad's
  // shape), but the TEXTURE'S UVs are cropped so the photo keeps ITS OWN aspect
  // and never distorts. This is also what the glass glyph refracts, so a
  // stretched photo here reads as a "squished" glyph even though its mesh never
  // changes. Guarded on bgImgAspect — until the image loads we fall back to the
  // old full 0..1 UV rect (whatever the loader default is) so nothing breaks.
  function fitBgUV() {
    if (!bgImgAspect) return;                       // image not loaded yet — no-op
    const planeAspect = camera.aspect;               // plane is scaled to the viewport shape
    let repeatX = 1, repeatY = 1;
    if (planeAspect > bgImgAspect) {
      // viewport wider than the photo -> fit by width, crop top/bottom
      repeatY = bgImgAspect / planeAspect;
    } else {
      // viewport taller/narrower than the photo -> fit by height, crop left/right
      repeatX = planeAspect / bgImgAspect;
    }
    bgTex.repeat.set(repeatX, repeatY);
    bgTex.offset.set((1 - repeatX) / 2, (1 - repeatY) / 2);   // keep the crop centered
  }

  // CLEAR REFRACTIVE GLASS — the glyph is a transparent glass object that bends
  // the background image seen THROUGH it. transmission=1 makes the surface see-
  // through; ior 1.5 + thickness set how hard the light bends (the visible warp);
  // roughness 0 keeps it clear (not frosted). metalness 0 — it's a dielectric.
  // envMap gives crisp surface highlights/reflections on the glass so it reads as
  // a solid physical object, not just a hole. transmission samples the SCENE
  // rendered behind the glass — so the bg image plane (added below) is what warps.
  const foil = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xffffff),            // clear (no tint)
    metalness: 0.0,
    roughness: 0.0,                              // clear glass, not frosted
    transmission: 1.0,                           // fully see-through -> refraction
    ior: 1.5,                                    // glass index of refraction
    thickness: 1.6,                              // how much light bends through the body
    clearcoat: 1.0,
    clearcoatRoughness: 0.0,
    // no explicit envMap — the glass inherits scene.environment (the bright PMREM)
    // for its surface highlights. The old CubeCamera reflection of the hero text
    // is removed (glass refracts the bg image; it doesn't need to mirror the copy).
    envMapIntensity: 1.0,
  });

  let model = null, baseScale = 1, baseY = 0, ready = false;

  const loader = new GLTFLoader();
  loader.load(MODEL, (gltf) => {
    model = gltf.scene;
    model.traverse(o => {
      if (o.isMesh) {
        if (o.material && o.material.dispose) o.material.dispose();
        o.material = foil;                          // liquid red chrome
        o.castShadow = o.receiveShadow = false;
      }
    });
    // center + normalize scale to a unit-ish height, orient upright
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);                       // center on origin
    const norm = 3.0 / Math.max(size.x, size.y, size.z);
    model.scale.setScalar(norm);
    pivot.add(model);
    ready = true;
    fit();
    // signal success so the host can drop the .poster fallback
    canvas.dispatchEvent(new CustomEvent('balloonready', { bubbles: true }));
  }, undefined, (err) => {
    console.warn('hero balloon: model load failed', err);
    canvas.dispatchEvent(new CustomEvent('balloonfailed', { bubbles: true }));
  });

  // ---- responsive framing: right-of-centre, like the old video's mobile crop
  function fit() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_DPR_HERO));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const portrait = w < 760;
    pivot.position.x = 0;                          // centered (was 1.8, right-offset)
    baseY = portrait ? 0.1 : 0.25;
    pivot.position.y = baseY;
    baseScale = portrait ? 0.85 : Math.min(1.15, h / 640);
    pivot.scale.setScalar(baseScale);
    fitBg();                                       // keep the bg plane's SHAPE filling the view
    fitBgUV();                                     // keep the bg PHOTO itself un-stretched (cover-crop)
  }
  fit();
  const isTouch = matchMedia('(hover:none) and (pointer:coarse)').matches;
  if (isTouch) {
    // On a phone the frequent "resize" is the URL bar collapsing on scroll (~60px
    // height change), and fit() recomputes baseScale from height — that grew/shrank
    // the glyph on every scroll (the "hiccup"). But a genuine ROTATION does change
    // width meaningfully and SHOULD re-fit. So on touch, re-fit only when the width
    // actually changes (orientation flip), never on a height-only URL-bar nudge.
    let lastW = canvas.clientWidth;
    addEventListener('resize', () => {
      const w = canvas.clientWidth;
      if (w === lastW) return;          // height-only (URL bar) — ignore
      lastW = w;
      fit();                            // real orientation change — re-fit
    }, { passive: true });
  } else {
    // desktop: live resize is meaningful
    addEventListener('resize', fit, { passive: true });
  }

  // ---- pointer parallax (mouse only) ----
  // DESKTOP only. On a phone there is no hovering pointer: every pointermove IS a
  // finger-drag scroll, so wiring parallax to it made the glyph tilt/lurch to follow
  // the finger as the page scrolled — that was the "jitter on scroll". Gate it on
  // a real hovering pointer so touch scrolls never feed the parallax.
  let px = 0, py = 0, tpx = 0, tpy = 0;
  if (!reduced && !isTouch) {
    addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;   // belt-and-braces: ignore touch points
      tpx = (e.clientX / innerWidth - 0.5) * 2;
      tpy = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  let t0 = performance.now(), raf = 0, running = true;
  function frame(now) {
    if (!running) return;
    const t = (now - t0) / 1000;
    px += (tpx - px) * 0.05; py += (tpy - py) * 0.05;

    if (ready) {
      if (reduced) {
        pivot.rotation.set(0, -0.2, 0);
        pivot.position.y = baseY;
      } else {
        // NOTE: no scrollT term — the hero PINS and the reader scrolls THROUGH it
        // to swap the headline lines, so scroll-linked drift would make the glyph
        // wander while it should hold. Idle bob + pointer parallax only.
        pivot.position.y = baseY + Math.sin(t * 0.6) * 0.12;
        pivot.rotation.y = -0.15 + px * 0.5 + Math.sin(t * 0.35) * 0.18;
        pivot.rotation.x = -py * 0.2 + Math.sin(t * 0.5) * 0.05;
        pivot.rotation.z = Math.sin(t * 0.45) * 0.05 + px * 0.06;
        pivot.scale.setScalar(baseScale * (1 + Math.sin(t * 0.9) * 0.02));
      }

      // (Text-reflection removed: the glass refracts the bg image and takes its
      // surface highlights from scene.environment, so no per-frame CubeCamera
      // capture of the hero headline is needed.)
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  // pause/resume tracks TWO independent signals — on-screen (IO) and tab-visible
  // (Page Visibility) — either one being false must stop the rAF loop, and it
  // should only resume when BOTH are true again (e.g. don't resume a
  // backgrounded tab's animation just because it happens to still intersect).
  let inView = true, pageVisible = !document.hidden;
  const setRunning = (next) => {
    if (next === running) return;
    running = next;
    if (running) { t0 = performance.now(); raf = requestAnimationFrame(frame); }
    else cancelAnimationFrame(raf);
  };

  const hero = canvas.closest('.hero') || canvas.parentElement;
  const io = new IntersectionObserver(es => {
    inView = es[0].isIntersecting;
    setRunning(inView && pageVisible);
  }, { threshold: 0.01 });
  io.observe(hero);

  const onVisibility = () => {
    pageVisible = !document.hidden;
    setRunning(inView && pageVisible);
  };
  document.addEventListener('visibilitychange', onVisibility);

  /* Context loss (GPU reset, or iOS evicting the oldest context when too many
     are alive): don't leave a frozen/blank hero — stop the loop and fall back
     to the poster image, same path as a failed model load. No restore attempt:
     the poster is a designed state, a half-restored scene is not. */
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();                       // we are NOT going to restore
    setRunning(false); io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.dispatchEvent(new CustomEvent('balloonfailed', { bubbles: true }));
  }, { once: true });

  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      running = false; cancelAnimationFrame(raf); io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      foil.dispose(); env.dispose();
      bgPlane.material.map?.dispose(); bgPlane.geometry.dispose(); bgPlane.material.dispose();
      renderer.dispose();
    },
  };
}
