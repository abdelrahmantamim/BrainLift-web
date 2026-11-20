#!/usr/bin/env node
/**
 * Static marketing page generator for getbrainlift.app.
 *
 * Reads Markdown from web/content/** and writes prerendered HTML into the
 * Vite output directory (dist/ by default) so Vercel serves real HTML for
 * /blog, /for, /compare and /press while the SPA keeps every other route.
 * Also writes robots.txt, sitemap.xml and blog/rss.xml.
 *
 * Usage: node scripts/build-seo.mjs [--out dist]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const outArg = process.argv.indexOf('--out');
const OUT = path.resolve(ROOT, outArg > -1 ? process.argv[outArg + 1] : 'dist');
const CONTENT = path.join(ROOT, 'content');

export const SITE = 'https://getbrainlift.app';
const APP_STORE = 'https://apps.apple.com/us/app/brainlift-ai-quiz-flashcard/id6749842070';
const WEB_APP = '/auth/register';
const ORG_NAME = 'BrainLift';
const DEFAULT_OG = `${SITE}/og/default.png`;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripTags = (html = '') => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const slugify = (s = '') =>
  s
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
const fmtDate = (iso) =>
  new Date(iso + (iso.length === 10 ? 'T12:00:00Z' : '')).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
const readingTime = (md) => Math.max(1, Math.round(md.split(/\s+/).length / 220));
const write = (rel, body) => {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
};

/** Minimal YAML front matter: scalars, inline [a, b] arrays, and "- item" lists. */
function parseFrontMatter(raw) {
  if (!raw.startsWith('---')) return { data: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { data: {}, body: raw };
  const block = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\s*\n/, '');
  const data = {};
  let currentKey = null;
  for (const line of block.split('\n')) {
    if (!line.trim()) continue;
    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(unquote(listItem[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    currentKey = kv[1];
    const value = kv[2].trim();
    if (value === '') {
      data[currentKey] = [];
    } else if (value.startsWith('[') && value.endsWith(']')) {
      data[currentKey] = value
        .slice(1, -1)
        .split(',')
        .map((v) => unquote(v.trim()))
        .filter(Boolean);
    } else if (value === 'true' || value === 'false') {
      data[currentKey] = value === 'true';
    } else {
      data[currentKey] = unquote(value);
    }
  }
  return { data, body };
}
const unquote = (v) => v.replace(/^["'](.*)["']$/, '$1');

// ---------------------------------------------------------------------------
// Markdown rendering with heading ids + table of contents
// ---------------------------------------------------------------------------
function renderMarkdown(md) {
  const headings = [];
  const renderer = new marked.Renderer();
  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const id = slugify(text);
    if (depth === 2) headings.push({ id, text: stripTags(text) });
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };
  renderer.table = function ({ header, rows }) {
    const th = header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join('');
    const body = rows
      .map((r) => `<tr>${r.map((c) => `<td>${this.parser.parseInline(c.tokens)}</td>`).join('')}</tr>`)
      .join('');
    return `<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>\n`;
  };
  renderer.link = function ({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const external = /^https?:\/\//.test(href) && !href.startsWith(SITE);
    const attrs = external ? ' rel="noopener" target="_blank"' : '';
    return `<a href="${href}"${title ? ` title="${esc(title)}"` : ''}${attrs}>${text}</a>`;
  };
  const html = marked.parse(md, { gfm: true, renderer });
  return { html, headings };
}

/** Pull "## FAQ" / "## Frequently asked questions" H3 question + answer pairs. */
function extractFaq(md) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => /^##\s+(faq|frequently asked questions)/i.test(l.trim()));
  if (start === -1) return [];
  const faq = [];
  let current = null;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) break;
    const q = line.match(/^###\s+(.*)$/);
    if (q) {
      current = { q: q[1].trim(), a: [] };
      faq.push(current);
    } else if (current) {
      current.a.push(line);
    }
  }
  return faq
    .map((f) => ({ q: f.q, a: stripTags(marked.parse(f.a.join('\n').trim())) }))
    .filter((f) => f.a);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
const CSS = fs.readFileSync(path.join(__dirname, 'seo-pages.css'), 'utf8');

function nav(section) {
  const link = (href, label, key) =>
    `<a href="${href}"${section === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="/" aria-label="BrainLift home">
      <img src="/icon-96x96.png" width="36" height="36" alt="" />
      <span>BrainLift</span>
    </a>
    <nav class="site-nav" aria-label="Main">
      ${link('/tools/', 'Tools', 'tools')}
      ${link('/blog/', 'Blog', 'blog')}
      ${link('/for/', 'Who it\'s for', 'for')}
      ${link('/compare/', 'Compare', 'compare')}
      <a class="btn btn-outline" href="${WEB_APP}">Try it on the web</a>
      <a class="btn btn-coral" href="${APP_STORE}" rel="noopener">Get the iPhone app</a>
    </nav>
  </div>
</header>`;
}

const footer = () => `
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <a class="brand" href="/"><img src="/icon-96x96.png" width="32" height="32" alt="" /><span>BrainLift</span></a>
      <p class="muted">Turn notes, PDFs and photos of your textbook into quizzes and flashcards, then study them with spaced repetition.</p>
      <p class="muted small">AI-generated study material can contain mistakes. Check important answers against your course materials.</p>
    </div>
    <div>
      <h2 class="footer-h">Product</h2>
      <a href="${APP_STORE}" rel="noopener">iPhone and iPad app</a>
      <a href="${WEB_APP}">Web app</a>
      <a href="/tools/">Tools: PDF, photo and notes to flashcards</a>
      <a href="/for/">Who it's for</a>
      <a href="/compare/">Compare study apps</a>
      <a href="/press/">Press kit</a>
    </div>
    <div>
      <h2 class="footer-h">Learn</h2>
      <a href="/blog/">Blog</a>
      <a href="/blog/rss.xml">RSS feed</a>
      <a href="/help">Help center</a>
    </div>
    <div>
      <h2 class="footer-h">Company</h2>
      <a href="/privacy">Privacy policy</a>
      <a href="/terms">Terms of use</a>
      <a href="/help">Contact support</a>
    </div>
  </div>
  <div class="wrap copyright muted small">© ${new Date().getUTCFullYear()} BrainLift. Apple, the Apple logo and App Store are trademarks of Apple Inc. Other product names are trademarks of their respective owners and are used here only to identify those products.</div>
</footer>`;

const ctaCard = (variant = 'article') => {
  const copy =
    variant === 'compare'
      ? {
          h: 'See for yourself, on your own notes',
          p: 'Upload a PDF or snap a photo of a page. BrainLift makes a quiz and a flashcard deck from it in about a minute. Free to start.',
        }
      : variant === 'tools'
        ? {
            h: 'Try it on your own file',
            p: 'Upload the PDF or snap the page you were just thinking about. Your first quiz and deck are free.',
          }
        : variant === 'for'
        ? {
            h: 'Make your first deck from real class material',
            p: 'Photo of your notes, a lecture PDF, or just a topic. Get a quiz and flashcards you can study today. Free to start.',
          }
        : {
            h: 'Turn this week\'s notes into flashcards',
            p: 'Scan a page or upload a PDF and BrainLift builds a quiz plus a spaced-repetition deck from it. Free to start, no card required.',
          };
  return `
<aside class="cta-card" aria-label="Try BrainLift">
  <h2>${copy.h}</h2>
  <p>${copy.p}</p>
  <div class="cta-actions">
    <a class="btn btn-coral" href="${APP_STORE}" rel="noopener">Download for iPhone</a>
    <a class="btn btn-outline" href="${WEB_APP}">Use it in the browser</a>
  </div>
</aside>`;
};

function layout({ title, description, canonical, ogImage, jsonLd = [], body, section, type = 'website', published, modified }) {
  const ld = jsonLd.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${canonical}" />
<link rel="icon" href="/favicon.ico" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="alternate" type="application/rss+xml" title="BrainLift blog" href="${SITE}/blog/rss.xml" />
<meta name="theme-color" content="#FFF8F0" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#1A1625" media="(prefers-color-scheme: dark)" />
<meta property="og:site_name" content="BrainLift" />
<meta property="og:type" content="${type}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${ogImage || DEFAULT_OG}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
${published ? `<meta property="article:published_time" content="${published}" />` : ''}
${modified ? `<meta property="article:modified_time" content="${modified}" />` : ''}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${ogImage || DEFAULT_OG}" />
<meta name="apple-itunes-app" content="app-id=6749842070" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap" />
<style>${CSS}</style>
${ld}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${nav(section)}
<main id="main">
${body}
</main>
${footer()}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// JSON-LD builders
// ---------------------------------------------------------------------------
const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: ORG_NAME,
  url: SITE,
  logo: `${SITE}/icon-512x512.png`,
};
export const appLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'BrainLift: AI Quiz + Flashcard',
  operatingSystem: 'iOS, iPadOS, Web',
  applicationCategory: 'EducationalApplication',
  url: SITE,
  downloadUrl: APP_STORE,
  installUrl: APP_STORE,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free to start. Optional Pro subscription.' },
  description:
    'Turn photos of notes, PDFs, or a topic into quizzes and flashcards. Study with spaced repetition, practice your mistakes, and ask an AI tutor.',
  publisher: { '@type': 'Organization', name: ORG_NAME, url: SITE },
};
const breadcrumbLd = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
});
const faqLd = (faq) =>
  faq.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }
    : null;

// ---------------------------------------------------------------------------
// Content loading
// ---------------------------------------------------------------------------
function loadDir(dir) {
  const full = path.join(CONTENT, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const raw = fs.readFileSync(path.join(full, f), 'utf8');
      const { data, body } = parseFrontMatter(raw);
      const slug = data.slug || f.replace(/\.md$/, '');
      if (data.draft) return null;
      return { ...data, slug, body, file: f };
    })
    .filter(Boolean)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

const breadcrumbsHtml = (items) =>
  `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items
    .map((it, i) =>
      i === items.length - 1
        ? `<li aria-current="page">${esc(it.name)}</li>`
        : `<li><a href="${it.url.replace(SITE, '')}">${esc(it.name)}</a></li>`,
    )
    .join('')}</ol></nav>`;

// ---------------------------------------------------------------------------
// Page renderers
// ---------------------------------------------------------------------------
const urls = [];
const addUrl = (loc, lastmod, priority = '0.7') => urls.push({ loc, lastmod, priority });

function renderArticlePage(post, { section, sectionName, sectionPath, ctaVariant, extraLd = [], related = [] }) {
  const { html, headings } = renderMarkdown(post.body);
  const faq = extractFaq(post.body);
  const url = `${SITE}${sectionPath}${post.slug}/`;
  const crumbs = [
    { name: 'Home', url: SITE },
    { name: sectionName, url: `${SITE}${sectionPath}` },
    { name: post.title, url },
  ];
  const published = post.date ? `${post.date}T09:00:00Z` : undefined;
  const modified = post.updated ? `${post.updated}T09:00:00Z` : published;
  const ogImage = post.image ? `${SITE}${post.image}` : `${SITE}/og/${section === 'blog' ? 'blog' : section === 'for' ? 'for' : section === 'compare' ? 'compare' : section === 'tools' ? 'default' : 'default'}.png`;

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': section === 'blog' ? 'BlogPosting' : 'Article',
    headline: post.title,
    description: post.description,
    image: ogImage,
    datePublished: published,
    dateModified: modified,
    author: { '@type': 'Organization', name: ORG_NAME, url: SITE },
    publisher: { '@type': 'Organization', name: ORG_NAME, logo: { '@type': 'ImageObject', url: `${SITE}/icon-512x512.png` } },
    mainEntityOfPage: url,
  };
  const jsonLd = [articleLd, breadcrumbLd(crumbs), ...extraLd, faqLd(faq)].filter(Boolean);

  const toc =
    headings.length >= 4
      ? `<nav class="toc" aria-label="On this page"><h2>On this page</h2><ol>${headings
          .map((h) => `<li><a href="#${h.id}">${h.text}</a></li>`)
          .join('')}</ol></nav>`
      : '';

  const keyPoints = Array.isArray(post.takeaways) && post.takeaways.length
    ? `<div class="takeaways"><h2>Key takeaways</h2><ul>${post.takeaways.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`
    : '';

  const compareNote =
    section === 'compare'
      ? `<p class="note">Details about other apps were compiled from their public websites and App Store listings on ${fmtDate(
          post.updated || post.date,
        )}. Prices and features change, so check each product's own site before deciding. ${esc(
          ORG_NAME,
        )} is not affiliated with any product named here.</p>`
      : '';

  const relatedHtml = related.length
    ? `<section class="related"><h2>Keep reading</h2><ul>${related
        .map((r) => `<li><a href="${r.href}">${esc(r.title)}</a><span class="muted"> ${esc(r.description)}</span></li>`)
        .join('')}</ul></section>`
    : '';

  const body = `
<article class="article">
  <div class="wrap article-grid">
    <div class="article-main">
      ${breadcrumbsHtml(crumbs)}
      <h1>${esc(post.title)}</h1>
      <p class="lede">${esc(post.description)}</p>
      <p class="byline muted small">${post.date ? `Published ${fmtDate(post.date)}` : ''}${
        post.updated && post.updated !== post.date ? ` · Updated ${fmtDate(post.updated)}` : ''
      } · ${readingTime(post.body)} min read · By the BrainLift team</p>
      ${compareNote}
      ${keyPoints}
      ${toc}
      <div class="prose">${html}</div>
      ${ctaCard(ctaVariant)}
      ${relatedHtml}
    </div>
    <div class="article-side">${ctaCard(ctaVariant)}</div>
  </div>
</article>`;

  write(`${sectionPath.slice(1)}${post.slug}/index.html`, layout({
    title: post.metaTitle || `${post.title} | BrainLift`,
    description: post.description,
    canonical: url,
    ogImage,
    jsonLd,
    body,
    section,
    type: 'article',
    published,
    modified,
  }));
  addUrl(url, (post.updated || post.date || today()), section === 'blog' ? '0.7' : '0.8');
}

const today = () => new Date().toISOString().slice(0, 10);

function cardList(items, basePath, colorFor) {
  return `<ul class="card-list">${items
    .map(
      (p, i) => `<li class="card card-${colorFor(p, i)}">
  <a href="${basePath}${p.slug}/"><h2>${esc(p.title)}</h2></a>
  <p>${esc(p.description)}</p>
  <p class="muted small">${p.date ? fmtDate(p.date) : ''}${p.date ? ' · ' : ''}${readingTime(p.body)} min read</p>
</li>`,
    )
    .join('')}</ul>`;
}

function renderIndex({ sectionPath, section, title, h1, intro, items, metaTitle, description, colorFor }) {
  const url = `${SITE}${sectionPath}`;
  const crumbs = [
    { name: 'Home', url: SITE },
    { name: title, url },
  ];
  const body = `
<section class="index-hero">
  <div class="wrap">
    ${breadcrumbsHtml(crumbs)}
    <h1>${esc(h1)}</h1>
    <p class="lede">${intro}</p>
  </div>
</section>
<section class="wrap">
  ${items.length ? cardList(items, sectionPath, colorFor) : '<p class="muted">New articles are on the way.</p>'}
</section>
<section class="wrap">${ctaCard(section === 'compare' ? 'compare' : section === 'for' ? 'for' : 'article')}</section>`;
  write(`${sectionPath.slice(1)}index.html`, layout({
    title: metaTitle,
    description,
    canonical: url,
    ogImage: `${SITE}/og/${section === 'tools' ? 'default' : section}.png`,
    jsonLd: [breadcrumbLd(crumbs), { '@context': 'https://schema.org', '@type': 'CollectionPage', name: h1, url, description }],
    body,
    section,
  }));
  addUrl(url, today(), '0.8');
}

function renderPress(press) {
  if (!press) return;
  const { html } = renderMarkdown(press.body);
  const url = `${SITE}/press/`;
  const crumbs = [
    { name: 'Home', url: SITE },
    { name: 'Press kit', url },
  ];
  const body = `
<article class="article">
  <div class="wrap article-grid">
    <div class="article-main">
      ${breadcrumbsHtml(crumbs)}
      <h1>${esc(press.title)}</h1>
      <p class="lede">${esc(press.description)}</p>
      <div class="prose">${html}</div>
    </div>
    <div class="article-side">${ctaCard('article')}</div>
  </div>
</article>`;
  write('press/index.html', layout({
    title: press.metaTitle || `${press.title} | BrainLift`,
    description: press.description,
    canonical: url,
    jsonLd: [breadcrumbLd(crumbs), orgLd, appLd],
    body,
    section: 'press',
  }));
  addUrl(url, press.updated || today(), '0.5');
}

function renderRss(posts) {
  const items = posts
    .slice(0, 30)
    .map(
      (p) => `<item>
  <title>${esc(p.title)}</title>
  <link>${SITE}/blog/${p.slug}/</link>
  <guid isPermaLink="true">${SITE}/blog/${p.slug}/</guid>
  <pubDate>${new Date(`${p.date}T09:00:00Z`).toUTCString()}</pubDate>
  <description>${esc(p.description)}</description>
</item>`,
    )
    .join('\n');
  write('blog/rss.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>BrainLift blog</title>
  <link>${SITE}/blog/</link>
  <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml" />
  <description>Study science, exam prep guides, and ways to turn your notes into quizzes and flashcards.</description>
  <language>en-us</language>
${items}
</channel>
</rss>`);
}

function renderSitemapAndRobots() {
  const staticPages = [
    { loc: `${SITE}/`, priority: '1.0' },
    { loc: `${SITE}/help`, priority: '0.4' },
    { loc: `${SITE}/privacy`, priority: '0.2' },
    { loc: `${SITE}/terms`, priority: '0.2' },
  ];
  const all = [...staticPages.map((p) => ({ ...p, lastmod: today() })), ...urls];
  write(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all
  .map(
    (u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>`,
  );
  write(
    'robots.txt',
    `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /chat
Disallow: /files
Disallow: /flashcards
Disallow: /quizzes
Disallow: /quiz/
Disallow: /profile
Disallow: /settings
Disallow: /test-endpoints
Disallow: /auth/reset-password
Disallow: /auth/apple/
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const posts = loadDir('blog');
  const audiences = loadDir('for').sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.title.localeCompare(b.title));
  const compares = loadDir('compare').sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.title.localeCompare(b.title));
  const tools = loadDir('tools').sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.title.localeCompare(b.title));
  const pressFile = path.join(CONTENT, 'press.md');
  const press = fs.existsSync(pressFile)
    ? (() => {
        const { data, body } = parseFrontMatter(fs.readFileSync(pressFile, 'utf8'));
        return { ...data, body };
      })()
    : null;

  const pick = (list, exclude, n, basePath) =>
    list
      .filter((p) => p.slug !== exclude)
      .slice(0, n)
      .map((p) => ({ title: p.title, description: p.description, href: `${basePath}${p.slug}/` }));

  for (const post of posts) {
    const sameTag = posts.filter((p) => p.slug !== post.slug && (p.tags || []).some((t) => (post.tags || []).includes(t)));
    const related = [...sameTag, ...posts.filter((p) => !sameTag.includes(p))];
    renderArticlePage(post, {
      section: 'blog',
      sectionName: 'Blog',
      sectionPath: '/blog/',
      ctaVariant: 'article',
      related: pick(related, post.slug, 3, '/blog/'),
    });
  }
  for (const page of audiences) {
    renderArticlePage(page, {
      section: 'for',
      sectionName: "Who it's for",
      sectionPath: '/for/',
      ctaVariant: 'for',
      extraLd: [appLd],
      related: pick(audiences, page.slug, 3, '/for/'),
    });
  }
  for (const page of compares) {
    renderArticlePage(page, {
      section: 'compare',
      sectionName: 'Compare',
      sectionPath: '/compare/',
      ctaVariant: 'compare',
      extraLd: [appLd],
      related: pick(compares, page.slug, 4, '/compare/'),
    });
  }

  for (const page of tools) {
    renderArticlePage(page, {
      section: 'tools',
      sectionName: 'Tools',
      sectionPath: '/tools/',
      ctaVariant: 'tools',
      extraLd: [appLd],
      related: pick(tools, page.slug, 3, '/tools/'),
    });
  }
  if (tools.length) {
    renderIndex({
      sectionPath: '/tools/',
      section: 'tools',
      title: 'Tools',
      h1: 'Turn what you already have into practice',
      intro: 'PDFs, photos of notes, typed notes or a topic. Pick the input you have and see exactly what BrainLift makes from it.',
      items: tools,
      metaTitle: 'PDF, photo and notes to flashcards and quizzes | BrainLift',
      description: 'Convert PDFs, photos of handwritten notes, typed notes or a topic into quizzes and flashcard decks in about a minute. Free to start.',
      colorFor: () => 'coral',
    });
  }

  const colors = ['coral', 'teal', 'yellow', 'lilac'];
  renderIndex({
    sectionPath: '/blog/',
    section: 'blog',
    title: 'Blog',
    h1: 'Study smarter, with evidence',
    intro:
      'Practical guides on active recall, spaced repetition and exam prep, written for students who want their study time to count.',
    items: posts,
    metaTitle: 'BrainLift blog: study science and exam prep guides',
    description:
      'Guides on active recall, spaced repetition, and turning lecture notes, PDFs and textbooks into quizzes and flashcards.',
    colorFor: (_p, i) => colors[i % colors.length],
  });
  renderIndex({
    sectionPath: '/for/',
    section: 'for',
    title: "Who it's for",
    h1: 'Built for the way your course actually tests you',
    intro:
      'Nursing, med school, law, AP classes, languages and certifications all test differently. See how BrainLift fits each one.',
    items: audiences,
    metaTitle: 'BrainLift for nursing, med, law, AP and language students',
    description:
      'How students in nursing, medicine, law, AP courses, languages and certification programs use BrainLift to turn course material into quizzes and flashcards.',
    colorFor: () => 'teal',
  });
  renderIndex({
    sectionPath: '/compare/',
    section: 'compare',
    title: 'Compare',
    h1: 'BrainLift compared with other study apps',
    intro:
      'Honest, side-by-side comparisons with Quizlet, Anki, Knowt, Brainscape and others, including where each one is the better pick.',
    items: compares,
    metaTitle: 'BrainLift vs Quizlet, Anki, Knowt and other study apps',
    description:
      'Side-by-side comparisons of BrainLift with Quizlet, Anki, Knowt, Brainscape and StudyFetch: features, pricing, and who each app suits best.',
    colorFor: () => 'lilac',
  });
  renderPress(press);
  renderRss(posts);
  renderSitemapAndRobots();

  console.log(
    `[seo] wrote ${posts.length} posts, ${audiences.length} audience pages, ${compares.length} comparisons, ${tools.length} tool pages${
      press ? ', press kit' : ''
    }, sitemap, robots, rss -> ${path.relative(ROOT, OUT)}`,
  );
}

main();
