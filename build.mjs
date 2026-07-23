// Build: render src/page.njk with every content/*.json exposed under its
// filename (settings, hero, offerings, ...) and write dist/index.html.
// The output must stay byte-identical to the source page for any content
// values that match the original copy — `npm run check` enforces this.
import fs from 'node:fs';
import path from 'node:path';
import nunjucks from 'nunjucks';

const env = new nunjucks.Environment(new nunjucks.FileSystemLoader('src'), {
  autoescape: false,          // copy may legitimately contain entities/markup
  throwOnUndefined: true,     // a missing content field must fail the build
});
// slides -> comma-joined image list for the .oshot data-photos attribute
env.addFilter('imgs', slides => slides.map(s => s.image).join(','));
// slides -> the modal's VERTICALS data (accent rides on the offering row).
// <-escape so no content string can ever terminate the <script> block.
env.addFilter('modaldata', items =>
  JSON.stringify(items.map(o => ({ id: o.id, accent: o.accentColor, slides: o.slides })))
    .replace(/</g, '\\u003c'));

const data = {};
for (const f of fs.readdirSync('content')) {
  if (!f.endsWith('.json')) continue;
  data[path.basename(f, '.json')] = JSON.parse(fs.readFileSync(path.join('content', f), 'utf8'));
}

// ---- content validation: fail the build (Vercel then keeps the previous
// deploy live) instead of shipping a page with holes. Keys listed in MAY_BE_EMPTY
// are designed-optional and guarded in the templates; everything else must have
// real text, lists must meet their minimums, and referenced images must exist.
const MAY_BE_EMPTY = new Set(['eyebrow', 'partnerLede', 'alt', 'alienAlt', 'bio', 'paragraphs', 'partnerList']);
const MIN_ITEMS = {  // path -> minimum entries
  'settings.sections': 1, 'hero.lines': 1, 'offerings.items': 1,
  'offerings.items[].slides': 1, 'work.items': 1, 'work.items[].photos': 1,
  'misfits.items': 1, 'audience.types': 1, 'manifesto.beats': 1, 'calling.items': 1,
};
const errors = [];
const walk = (val, path, generic) => {
  if (typeof val === 'string') {
    const key = path.replace(/.*\./, '').replace(/\[\d+\]$/, '');
    if (!val.trim() && !MAY_BE_EMPTY.has(key)) errors.push(`${path}: empty — add text or delete the item`);
    if (/<\s*script/i.test(val)) errors.push(`${path}: contains a <script> tag — not allowed in content`);
    if (val.startsWith('assets/')) {
      if (/[,"']/.test(val)) errors.push(`${path}: image path "${val}" contains a comma or quote — rename the file`);
      if (!fs.existsSync(val)) errors.push(`${path}: image "${val}" not found in assets/`);
      else if (fs.statSync(val).size > 1_500_000) errors.push(`${path}: image "${val}" is over 1.5MB — resize/compress it (the CMS converts uploads automatically; this one likely bypassed it)`);
    }
  } else if (Array.isArray(val)) {
    if ((MIN_ITEMS[generic] ?? 0) > val.length) errors.push(`${generic}: needs at least ${MIN_ITEMS[generic]} item(s), has ${val.length}`);
    val.forEach((v, i) => walk(v, `${path}[${i}]`, `${generic}[]`));
  } else if (val && typeof val === 'object') {
    for (const [k, v] of Object.entries(val)) walk(v, `${path}.${k}`, `${generic}.${k}`);
  }
};
for (const [name, val] of Object.entries(data)) walk(val, name, name);
const sectionSlugs = new Set(fs.readdirSync('src/sections').map(f => path.basename(f, '.njk')));
const seen = new Set();
for (const s of data.settings.sections) {
  if (!sectionSlugs.has(s.section)) errors.push(`settings.sections: unknown section "${s.section}"`);
  if (seen.has(s.section)) errors.push(`settings.sections: "${s.section}" appears more than once`);
  seen.add(s.section);
}
if (errors.length) {
  console.error('CONTENT ERRORS — build refused, the live site keeps its previous version:');
  for (const e of errors) console.error('  · ' + e);
  process.exit(1);
}

const html = env.render('page.njk', data);

// site-critical asset check: the page + hero script reference assets the content
// JSON never mentions (balloon GLB, poster, matcaps, grain...). If an operator
// deletes/renames one in the media library, catch it here instead of shipping.
const referenced = new Set();
for (const src of [html, fs.readFileSync('vendor/hero-balloon.js', 'utf8')]) {
  for (const m of src.matchAll(/assets\/[A-Za-z0-9._/-]+\.[a-z0-9]{2,5}/g)) referenced.add(m[0]);
}
const missing = [...referenced].filter(p => !fs.existsSync(p));
if (missing.length) {
  console.error('MISSING ASSETS — build refused, the live site keeps its previous version:');
  for (const p of missing) console.error(`  · ${p} is referenced by the site but does not exist (deleted or renamed in the media library?)`);
  process.exit(1);
}

fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
// keep the repo-root page in sync: it's what the local dev server (and any
// root-serving static host) serves
fs.writeFileSync('index.html', html);

// static payload for deploys (Vercel outputDirectory = dist)
for (const dir of ['assets', 'vendor', 'admin']) {
  if (fs.existsSync(dir)) fs.cpSync(dir, path.join('dist', dir), { recursive: true });
}
console.log(`built dist/index.html (${html.length}b) — sections: ${data.settings.sections.map(s => s.visible ? s.section : `(${s.section} hidden)`).join(' → ')}`);
