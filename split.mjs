// ONE-TIME surgery: cut index.html into template partials whose concatenation
// is byte-identical to the original. Run once, verify with `npm run check`,
// then this file can be deleted. Section units are cut from the start of their
// leading comment block through their closing tag (= up to the next unit's
// comment), so each partial is self-contained and reorderable.
import fs from 'node:fs';

const src = fs.readFileSync('index.html', 'utf8');

// boundary markers, in document order (each must appear exactly once)
const marks = {
  nav:        '<nav class="nav" id="nav">',
  deck:       '<div class="deck" id="top">',
  manifesto:  '  <!-- ============================================================\n       MANIFESTO',
  misfits:    '  <!-- THE MISFITS BRIGADE',
  offerings:  '  <!-- OFFERINGS —',
  work:       '  <!-- THE MISFITS ACTS —',
  'for-brands': '  <!-- FOR BRANDS —',
  calling:    '  <!-- WE WORK WITH —',
  foot:       '  <!-- FOOTER —',
};
const at = {};
for (const [k, m] of Object.entries(marks)) {
  const i = src.indexOf(m);
  if (i < 0 || src.indexOf(m, i + 1) >= 0) throw new Error(`marker not unique: ${k}`);
  at[k] = i;
}
const order = Object.values(at);
if (String(order) !== String([...order].sort((a, b) => a - b))) throw new Error('markers out of order');

const chunks = {
  'src/head.njk': src.slice(0, at.nav),
  'src/nav.njk': src.slice(at.nav, at.deck),
  'src/hero.njk': src.slice(at.deck, at.manifesto),
  'src/sections/manifesto.njk': src.slice(at.manifesto, at.misfits),
  'src/sections/misfits.njk': src.slice(at.misfits, at.offerings),
  'src/sections/offerings.njk': src.slice(at.offerings, at.work),
  'src/sections/work.njk': src.slice(at.work, at['for-brands']),
  'src/sections/for-brands.njk': src.slice(at['for-brands'], at.calling),
  'src/sections/calling.njk': src.slice(at.calling, at.foot),
  'src/foot.njk': src.slice(at.foot),
};

fs.mkdirSync('src/sections', { recursive: true });
for (const [p, c] of Object.entries(chunks)) fs.writeFileSync(p, c);

// page shell: pure concatenation — ONE line so the template itself adds no bytes
fs.writeFileSync('src/page.njk',
  '{% include "head.njk" %}{% include "nav.njk" %}{% include "hero.njk" %}' +
  '{% for s in settings.sections %}{% include "sections/" ~ s ~ ".njk" %}{% endfor %}' +
  '{% include "foot.njk" %}');

fs.mkdirSync('content', { recursive: true });
fs.writeFileSync('content/settings.json', JSON.stringify({
  sections: ['manifesto', 'misfits', 'offerings', 'work', 'for-brands', 'calling'],
}, null, 2) + '\n');

console.log('split ok:', Object.keys(chunks).map(p => `${p} (${chunks[p].length}b)`).join(', '));
