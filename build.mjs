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

const data = {};
for (const f of fs.readdirSync('content')) {
  if (!f.endsWith('.json')) continue;
  data[path.basename(f, '.json')] = JSON.parse(fs.readFileSync(path.join('content', f), 'utf8'));
}

const html = env.render('page.njk', data);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
// keep the repo-root page in sync: it's what the local dev server (and any
// root-serving static host) serves
fs.writeFileSync('index.html', html);

// static payload for deploys (Vercel outputDirectory = dist)
for (const dir of ['assets', 'vendor', 'admin']) {
  if (fs.existsSync(dir)) fs.cpSync(dir, path.join('dist', dir), { recursive: true });
}
console.log(`built dist/index.html (${html.length}b) — sections: ${data.settings.sections.join(' → ')}`);
