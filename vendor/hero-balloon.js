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

const MODEL = 'assets/brand/cmf-hunyuan-uv.glb';   // re-processed: smooth normals + UV unwrap

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

  // ---- reflection backdrop: a plane behind the balloon carrying the hero's
  //      headline + ink tone, so the CubeCamera has the actual page copy to
  //      mirror onto the foil (the balloon lives on a WebGL canvas OVER the DOM,
  //      so it can't see the real HTML — we recreate the copy in-scene). -------
  // Draw ONE beat's lines to a pre-mirrored canvas texture. Pre-baked once per
  // beat (never redrawn per-frame) — "synced" comes from swapping which pre-baked
  // texture is shown + fading the plane with the hero's live reveal, NOT from
  // redrawing pixels. (Cheap: a pointer swap + an opacity write, no texture upload
  // per frame.) Pre-mirrored horizontally so the reflection in the steel reads.
  function makeBeatTexture(lines) {
    const w = 1024, h = 640;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.fillStyle = '#231F20'; g.fillRect(0, 0, w, h);
    g.translate(w, 0); g.scale(-1, 1);                        // pre-mirror
    g.font = '900 62px "NHG", Arial, sans-serif';
    g.textBaseline = 'top';
    // vertically center the block for however many lines this beat has
    const startY = h / 2 - (lines.length * 74) / 2;
    lines.forEach((ln, i) => {
      const y = startY + i * 74;
      if (ln.includes('(Mis)')) {
        const [a, , c] = ln.split(/(\(Mis\))/);
        let x = 90; g.fillStyle = '#fff'; g.fillText(a, x, y);
        x += g.measureText(a).width; g.fillStyle = '#DB1A21'; g.fillText('(Mis)', x, y);
        x += g.measureText('(Mis)').width; g.fillStyle = '#fff'; g.fillText(c, x, y);
      } else { g.fillStyle = '#fff'; g.fillText(ln, 90, y); }
    });
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  // Pre-bake one texture per hero beat (read from the live DOM so copy stays in
  // sync with whatever the page ships). Each beat = its .ph phrase lines.
  const hstage = document.querySelector('.hero .hstage');
  const beatEls = hstage ? Array.from(hstage.querySelectorAll('.hbeat')) : [];
  const beatTextures = beatEls.map(el =>
    makeBeatTexture(Array.from(el.querySelectorAll('.ph')).map(p => p.textContent.trim()))
  );
  // Fallback single texture if the DOM isn't what we expect.
  if (!beatTextures.length) beatTextures.push(makeBeatTexture(['We are Cultural (Mis)fits.']));

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 10),
    new THREE.MeshBasicMaterial({ map: beatTextures[0], toneMapped: false })
  );
  // In FRONT of the glyph (positive Z, camera side) and centered on the glyph's
  // X (~1.8) so its reflection bounces back toward the viewer and reads — a text
  // plane BEHIND the glyph only reflects on the far side, invisible to the camera
  // (diagnosed w/ Codex). rotation.y=PI faces the plane's front toward the cube
  // camera (PlaneGeometry faces +Z; unrotated the cube cam would see its culled
  // back face). The canvas art is pre-mirrored so the reflection reads normally.
  backdrop.position.set(1.8, 0.25, 4.0);
  backdrop.rotation.y = Math.PI;          // face front toward the glyph + camera
  backdrop.visible = false;               // only the CUBE CAMERA sees it, not the main render
  scene.add(backdrop);

  // ---- keep the reflected text in SYNC with the live hero, cheaply ------------
  // On beat change: swap which pre-baked texture the plane shows (pointer swap).
  // Per frame: read the ACTIVE beat's reveal progress (the hero's typewriter sets
  // `--rv` 0->1 on the .on beat) and drive the plane's opacity from it, so the
  // reflected text ghosts in AS the hero types. No canvas redraw, no re-upload.
  let activeBeat = beatEls.findIndex(el => el.classList.contains('on'));
  if (activeBeat < 0) activeBeat = 0;
  backdrop.material.map = beatTextures[activeBeat] || beatTextures[0];
  function syncActiveBeat() {
    const i = beatEls.findIndex(el => el.classList.contains('on'));
    if (i >= 0 && i !== activeBeat) {
      activeBeat = i;
      backdrop.material.map = beatTextures[i] || beatTextures[0];
    }
  }
  const beatObserver = hstage ? new MutationObserver(syncActiveBeat) : null;
  if (beatObserver) beatObserver.observe(hstage, { attributes: true, attributeFilter: ['class'], subtree: true });

  // ---- CubeCamera: captures the scene (backdrop + env) around the balloon into
  //      a live cubemap the foil reflects, so the headline actually mirrors. ---
  const cubeRT = new THREE.WebGLCubeRenderTarget(512, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const cubeCam = new THREE.CubeCamera(0.1, 100, cubeRT);
  scene.add(cubeCam);

  // ---- STUDIO LIGHT-CARDS: bright emissive strips that ONLY the reflection
  //      cube camera sees (toggled visible just during cube capture, like the
  //      backdrop). Polished steel is a mirror — in a black room it reflects
  //      black. These give it a lit studio to reflect (the streaked highlights
  //      that read as real stainless) WITHOUT lighting up the black page bg.
  const studio = new THREE.Group();
  studio.visible = false;                        // hidden from the main camera
  const cardMat = (c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, toneMapped: false });
  const CARDS = [
    { pos: [-7,  4, -2], rot: [0, 0.9, 0.3], size: [6, 14], color: 0xffffff, i: 1.0 },  // key streak
    { pos: [ 7,  2, -1], rot: [0, -0.8, -0.2], size: [4, 12], color: 0xdfe6ff, i: 0.8 }, // cool rim streak
    { pos: [ 0,  8,  2], rot: [1.2, 0, 0], size: [10, 4], color: 0xffffff, i: 0.9 },      // top bar
    { pos: [-2, -6,  3], rot: [-1.1, 0, 0], size: [8, 3], color: 0x8fa0c0, i: 0.5 },      // dim floor bounce
  ];
  CARDS.forEach(c => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(c.size[0], c.size[1]), cardMat(c.color));
    m.position.set(...c.pos); m.rotation.set(...c.rot);
    m.material.color.multiplyScalar(c.i);
    studio.add(m);
  });
  scene.add(studio);

  // ---- procedural mylar crinkle. The re-processed mesh now has proper UVs, so a
  //      standard normalMap works (the raw Hunyuan export had NO UVs/normals — a
  //      normal map then sampled a single texel for every vertex and darkened the
  //      whole surface). Integer-hash value noise → a clean tangent-space normal
  //      map (base ~128,128,255, gentle slopes). Kept SUBTLE so highlights break
  //      like foil without scattering the metal's reflection into the dark env.
  function makeFoilCrinkleNormalMap(N = 512) {
    const height = new Float32Array(N * N);
    const hash = (x, y) => {
      let n = x * 374761393 + y * 668265263;
      n = (n ^ (n >>> 13)) * 1274126177;
      return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    };
    const smooth = t => t * t * (3 - 2 * t);
    function noise(x, y, cells) {
      const s = N / cells;
      const fx = x / s, fy = y / s;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = smooth(fx - ix), ty = smooth(fy - iy);
      const a = hash(ix, iy), b = hash(ix + 1, iy),
            c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
      return THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let h = 0;
      h += (noise(x, y, 12)  - 0.5) * 0.45;
      h += (noise(x, y, 36)  - 0.5) * 0.22;
      h += (noise(x, y, 110) - 0.5) * 0.08;
      height[y * N + x] = h;
    }
    const c = document.createElement('canvas'); c.width = c.height = N;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(N, N);
    const H = (x, y) => height[((y + N) % N) * N + ((x + N) % N)];
    const strength = 0.5;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1.0;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * N + x) * 4;
      img.data[i]     = Math.round((nx * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
    t.colorSpace = THREE.NoColorSpace;
    return t;
  }

  const normalMap = makeFoilCrinkleNormalMap();

  // POLISHED STAINLESS STEEL — neutral mirror metal. A metalness:1 mirror in a
  // black room reflects black (silhouette); we DON'T fake that with a rim glow —
  // instead the studio light-cards above give the mirror real bright streaks to
  // reflect (product-shot lighting), so the steel reads as steel. clearcoat is a
  // sharp lacquer top coat; the faint normalMap ripples the streaks like brushed
  // liquid metal. A cool, faint Fresnel rim (white-blue) just cleans up the
  // silhouette at grazing angles where a card might not land — no brand colour.
  const fresnelUniforms = {
    uFresnelColor: { value: new THREE.Color(0xbcd0ff) }, // cool steel-white rim
    uFresnelPower: { value: 4.0 },                        // thin, subtle
    uFresnelGain:  { value: 0.35 },                       // faint — cards do the real work
  };
  const foil = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xaab0b8),            // neutral steel gray
    metalness: 1.0,
    roughness: 0.13,                             // soft polished steel: bright from the env, text ghosts through
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    normalMap,                                   // faint brushed-metal ripple
    normalScale: new THREE.Vector2(0.1, 0.1),
    // Reflect the live CubeCamera (bright studio env as background + the headline
    // backdrop) so the steel MIRRORS THE TEXT. This only works now that the cube
    // capture has a bright background (scene.background = env during capture) —
    // previously the cube was mostly black, which caused the silhouette bug.
    envMap: cubeRT.texture,
    envMapIntensity: 1.4,
  });
  // Faint cool Fresnel rim to hold the silhouette where no light-card reflects.
  foil.onBeforeCompile = (shader) => {
    shader.uniforms.uFresnelColor = fresnelUniforms.uFresnelColor;
    shader.uniforms.uFresnelPower = fresnelUniforms.uFresnelPower;
    shader.uniforms.uFresnelGain  = fresnelUniforms.uFresnelGain;
    shader.fragmentShader =
      'uniform vec3 uFresnelColor;\nuniform float uFresnelPower;\nuniform float uFresnelGain;\n'
      + shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float _fdNV = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
         float _fres = pow(1.0 - _fdNV, uFresnelPower) * uFresnelGain;
         totalEmissiveRadiance += uFresnelColor * _fres;`
      );
  };

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
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const portrait = w < 760;
    pivot.position.x = portrait ? 0.4 : 1.8;
    baseY = portrait ? 0.1 : 0.25;
    pivot.position.y = baseY;
    baseScale = portrait ? 0.85 : Math.min(1.15, h / 640);
    pivot.scale.setScalar(baseScale);
  }
  fit();
  addEventListener('resize', fit, { passive: true });

  // ---- pointer + scroll parallax --------------------------------------------
  let px = 0, py = 0, tpx = 0, tpy = 0, scrollT = 0;
  if (!reduced) {
    addEventListener('pointermove', e => {
      tpx = (e.clientX / innerWidth - 0.5) * 2;
      tpy = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });
    addEventListener('scroll', () => { scrollT = scrollY / innerHeight; }, { passive: true });
  }

  let t0 = performance.now(), raf = 0, running = true, frameCount = 0;
  function frame(now) {
    if (!running) return;
    const t = (now - t0) / 1000;
    px += (tpx - px) * 0.05; py += (tpy - py) * 0.05;

    if (ready) {
      if (reduced) {
        pivot.rotation.set(0, -0.2, 0);
        pivot.position.y = baseY;
      } else {
        pivot.position.y = baseY + Math.sin(t * 0.6) * 0.12 - scrollT * 0.5;
        pivot.rotation.y = -0.15 + px * 0.5 + Math.sin(t * 0.35) * 0.18;
        pivot.rotation.x = -py * 0.2 - scrollT * 0.2 + Math.sin(t * 0.5) * 0.05;
        pivot.rotation.z = Math.sin(t * 0.45) * 0.05 + px * 0.06;
        pivot.scale.setScalar(baseScale * (1 + Math.sin(t * 0.9) * 0.02));
      }

      // refresh the reflection: put the cube camera where the balloon is, show the
      // backdrop (headline) AND set the bright PMREM env as the scene BACKGROUND so
      // the empty cube faces reflect the studio (not black — that was the silhouette
      // bug); hide the balloon so it doesn't mirror itself; capture; then restore
      // (background back to null so the PAGE stays black). Every 2nd frame (~30fps).
      if ((frameCount++ & 1) === 0) {
        // sync the reflected text to the hero by swapping to the current beat's
        // pre-baked texture (opaque, solid — so the reflection never flickers to
        // "bare"; fading a transparent backdrop let the black void bleed through
        // the mirror and pop). The card stays a steady ink plane; only the WORDS
        // change on beat swap.
        syncActiveBeat();
        pivot.getWorldPosition(cubeCam.position);
        scene.background = env;                 // bright studio fills the mirror
        backdrop.visible = true;                // + the headline text to reflect
        studio.visible = true;
        model.visible = false;
        cubeCam.update(renderer, scene);
        model.visible = true;
        studio.visible = false;
        backdrop.visible = false;
        scene.background = null;                // page background stays transparent/black
      }
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  const hero = canvas.closest('.hero') || canvas.parentElement;
  const io = new IntersectionObserver(es => {
    const vis = es[0].isIntersecting;
    if (vis && !running) { running = true; t0 = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!vis) { running = false; cancelAnimationFrame(raf); }
  }, { threshold: 0.01 });
  io.observe(hero);

  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      running = false; cancelAnimationFrame(raf); io.disconnect();
      beatObserver?.disconnect();
      normalMap.dispose(); foil.dispose(); env.dispose();
      cubeRT.dispose(); backdrop.geometry.dispose();
      beatTextures.forEach(t => t.dispose()); backdrop.material.dispose();
      studio.children.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
      renderer.dispose();
    },
  };
}
