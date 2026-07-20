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
  scene.environment = env;

  const key  = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-4, 5, 6); scene.add(key);
  const rim  = new THREE.DirectionalLight(0xe8eeff, 1.6); rim.position.set(5, 2, 3);  scene.add(rim);
  const fill = new THREE.HemisphereLight(0xffffff, 0x231f20, 0.8); scene.add(fill);

  const pivot = new THREE.Group();
  scene.add(pivot);

  // ---- reflection backdrop: a plane behind the balloon carrying the hero's
  //      headline + ink tone, so the CubeCamera has the actual page copy to
  //      mirror onto the foil (the balloon lives on a WebGL canvas OVER the DOM,
  //      so it can't see the real HTML — we recreate the copy in-scene). -------
  function heroBackdropTexture() {
    const w = 1024, h = 640;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.fillStyle = '#231F20'; g.fillRect(0, 0, w, h);          // hero ink
    g.fillStyle = '#FFFFFF';
    g.font = '900 62px "NHG", Arial, sans-serif';
    g.textBaseline = 'top';
    const lines = ['A Catalyst for Culture.', 'A Sanctuary for the Misfits.', 'We are Cultural (Mis)fits.'];
    lines.forEach((ln, i) => {
      const y = 210 + i * 74;
      // draw, tinting the "(Mis)" red to match the hero accent
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
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 10),
    new THREE.MeshBasicMaterial({ map: heroBackdropTexture(), toneMapped: false })
  );
  backdrop.position.set(-1.5, 0.5, -4);   // behind the balloon, filling the view
  backdrop.visible = false;               // only the CUBE CAMERA sees it, not the main render
  scene.add(backdrop);

  // ---- CubeCamera: captures the scene (backdrop + env) around the balloon into
  //      a live cubemap the foil reflects, so the headline actually mirrors. ---
  const cubeRT = new THREE.WebGLCubeRenderTarget(512, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const cubeCam = new THREE.CubeCamera(0.1, 100, cubeRT);
  scene.add(cubeCam);

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

  // RED LATEX BALLOON — non-metallic, per the correct balloon recipe (a balloon
  // is latex/mylar, NOT metal; the metallic version was what produced the harsh,
  // patchy, "dented" highlights). Key ingredients:
  //   • metalness 0            — balloons are dielectric, not metal
  //   • sheen                  — the soft fabric-like halo around the rim that
  //                              gives inflated latex its characteristic glow
  //   • thin transmission +    — a little light passes THROUGH the skin, the
  //     thickness/ior 1.45        translucent-latex look
  //   • clearcoat              — the wet glossy top coat
  //   • soft roughness         — one broad, smooth highlight, not a sharp streak
  // envMap is the live CubeCamera (mirrors the hero headline), softened.
  const foil = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xE01620),
    metalness: 0.0,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.18,
    sheen: 1.0,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(0xff6a70),      // warm red rim halo
    transmission: 0.18,                          // subtle light-through-latex
    thickness: 1.2,
    ior: 1.45,
    attenuationColor: new THREE.Color(0xE01620),
    attenuationDistance: 2.5,
    emissive: new THREE.Color(0xDB1A21),
    emissiveIntensity: 0.12,
    envMap: cubeRT.texture,
    envMapIntensity: 1.1,
  });
  void normalMap;                               // kept generated but unused (smooth look)

  let model = null, baseScale = 1, baseY = 0, ready = false;

  const loader = new GLTFLoader();
  loader.load(MODEL, (gltf) => {
    model = gltf.scene;
    model.traverse(o => {
      if (o.isMesh) {
        if (o.material && o.material.dispose) o.material.dispose();
        o.material = foil;                         // our foil, not the white default
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

      // refresh the reflection: put the cube camera where the balloon is, show
      // the backdrop (headline), hide the balloon so it doesn't mirror itself,
      // capture the cubemap, then restore. Every 2nd frame is plenty (~30fps
      // reflection update) and keeps the extra 6-face render cheap.
      if ((frameCount++ & 1) === 0) {
        pivot.getWorldPosition(cubeCam.position);
        backdrop.visible = true;
        model.visible = false;
        cubeCam.update(renderer, scene);
        model.visible = true;
        backdrop.visible = false;
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
      normalMap.dispose(); foil.dispose(); env.dispose();
      cubeRT.dispose(); backdrop.geometry.dispose(); backdrop.material.map?.dispose(); backdrop.material.dispose();
      renderer.dispose();
    },
  };
}
