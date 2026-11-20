// Verifies every internal link in generated HTML resolves to a generated file or a known SPA route.
import fs from 'node:fs';
import path from 'node:path';
const dist = path.resolve(process.argv[2] || 'dist');
const spaRoutes = new Set(['/', '/terms', '/privacy', '/help', '/support', '/auth/login', '/auth/register', '/auth/forgot-password']);
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') && files.push(p); } })(dist);
let bad = 0, total = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  for (const m of html.matchAll(/href="([^"#?]+)[^"]*"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:)/.test(href)) continue;
    total++;
    const clean = href.replace(/\/$/, '');
    const ok = spaRoutes.has(href) || spaRoutes.has(clean || '/') ||
      fs.existsSync(path.join(dist, href)) || fs.existsSync(path.join(dist, href, 'index.html')) || fs.existsSync(path.join(dist, clean + '.html'));
    if (!ok) { bad++; console.log(`BROKEN ${href}  in ${path.relative(dist, f)}`); }
  }
}
console.log(`[links] checked ${total} internal links in ${files.length} pages, ${bad} broken`);
process.exit(bad ? 1 : 0);
