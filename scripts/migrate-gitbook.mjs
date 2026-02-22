#!/usr/bin/env node
import {
  readFileSync, writeFileSync, mkdirSync, existsSync,
  readdirSync, copyFileSync, statSync, rmSync
} from 'fs';
import { join, dirname, relative, resolve, basename } from 'path';

const ROOT = process.cwd();
const OUTPUT_DIR = join(ROOT, 'content', 'docs');
const ASSETS_SRC = join(ROOT, 'assets');
const ASSETS_DST = join(ROOT, 'public', 'assets');

// ═══════════════════════════════════════════════
//  SUMMARY.md Parser
// ═══════════════════════════════════════════════

function parseSummary() {
  const raw = readFileSync(join(ROOT, 'SUMMARY.md'), 'utf8');
  const lines = raw.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith('<!--') || line.includes('<!--')) continue;

    const secMatch = line.match(/^## (.+)/);
    if (secMatch) {
      current = { title: secMatch[1].trim(), entries: [] };
      sections.push(current);
      continue;
    }

    const pageMatch = line.match(/^(\s*)\* \[(.+?)]\((.+?)\)/);
    if (pageMatch && current) {
      const depth = Math.floor(pageMatch[1].length / 2);
      current.entries.push({
        title: pageMatch[2],
        path: pageMatch[3],
        depth,
      });
    }
  }
  return sections;
}

// ═══════════════════════════════════════════════
//  Include Resolution
// ═══════════════════════════════════════════════

function resolveIncludes(content, filePath) {
  return content.replace(
    /\{%\s*include\s+"([^"]+)"\s*%\}/g,
    (_m, incPath) => {
      let abs = resolve(dirname(filePath), incPath);
      if (!existsSync(abs)) {
        // GitBook resolves includes relative to repo root — strip leading ../
        const stripped = incPath.replace(/^(\.\.\/)+/, '');
        abs = resolve(ROOT, stripped);
      }
      if (!existsSync(abs)) {
        // Last resort: find the .gitbook/ segment and resolve from ROOT
        const gbIdx = incPath.indexOf('.gitbook/');
        if (gbIdx !== -1) abs = resolve(ROOT, incPath.slice(gbIdx));
      }
      if (!existsSync(abs)) {
        console.warn(`  WARN include not found: ${incPath}`);
        return _m;
      }
      let inc = readFileSync(abs, 'utf8');
      inc = inc.replace(/^---[\s\S]*?---\n?/, '');
      return inc.trim();
    }
  );
}

// ═══════════════════════════════════════════════
//  Frontmatter Cleanup
// ═══════════════════════════════════════════════

function cleanFrontmatter(content) {
  const fmRegex = /^---\n([\s\S]*?)\n---/;
  const m = fmRegex.exec(content);
  if (!m) return content;

  const lines = m[1].split('\n');
  const kept = [];
  let skip = false;

  for (const ln of lines) {
    if (/^layout:/.test(ln)) { skip = true; continue; }
    if (/^icon:/.test(ln)) continue;
    if (skip) {
      if (/^\s/.test(ln)) continue;
      skip = false;
    }
    kept.push(ln);
  }

  const fm = kept.join('\n').trim();
  if (!fm) return content.replace(fmRegex, '').replace(/^\n+/, '');
  return content.replace(fmRegex, `---\n${fm}\n---`);
}

// ═══════════════════════════════════════════════
//  {% code %} Blocks
// ═══════════════════════════════════════════════

const LANG_ALIASES = { gradle: 'groovy', plaintext: 'text' };

function transformCodeBlocks(content) {
  let c = content.replace(
    /\{%\s*code\s*(.*?)\s*%\}\n(```[\s\S]*?```)\n?\{%\s*endcode\s*%\}/g,
    (_m, attrs, codeBlock) => {
      const titleMatch = attrs.match(/title="([^"]+)"/);
      if (titleMatch) {
        return codeBlock.replace(/^```(\w*)/, (_cm, lang) => {
          const l = LANG_ALIASES[lang] || lang || 'text';
          return '```' + l + ' title="' + titleMatch[1] + '"';
        });
      }
      return codeBlock;
    }
  );
  // Also fix unsupported languages in plain code blocks (no {% code %} wrapper)
  c = c.replace(/^```(\w+)/gm, (_m, lang) => {
    return '```' + (LANG_ALIASES[lang] || lang);
  });
  return c;
}

// ═══════════════════════════════════════════════
//  {% hint %} Blocks
// ═══════════════════════════════════════════════

const HINT_MAP = { info: 'info', warning: 'warn', danger: 'error', success: 'info' };

function transformHints(content) {
  return content.replace(
    /\{%\s*hint\s+style="(\w+)"\s*%\}\n?([\s\S]*?)\{%\s*endhint\s*%\}/g,
    (_m, style, body) => {
      const type = HINT_MAP[style] || 'info';
      return `<Callout type="${type}">\n${body.trim()}\n</Callout>`;
    }
  );
}

// ═══════════════════════════════════════════════
//  {% tabs %} Blocks
// ═══════════════════════════════════════════════

function transformTabs(content) {
  return content.replace(
    /\{%\s*tabs\s*%\}\n([\s\S]*?)\{%\s*endtabs\s*%\}/g,
    (_m, inner) => {
      const tabs = [];
      const re = /\{%\s*tab\s+title="([^"]+)"\s*%\}\n?([\s\S]*?)\{%\s*endtab\s*%\}/g;
      let t;
      while ((t = re.exec(inner))) tabs.push({ title: t[1], body: t[2].trim() });
      if (!tabs.length) return _m;

      const items = tabs.map(t => `"${t.title}"`).join(', ');
      const elems = tabs
        .map(t => `<Tab value="${t.title}">\n${t.body}\n</Tab>`)
        .join('\n');
      return `<Tabs items={[${items}]}>\n${elems}\n</Tabs>`;
    }
  );
}

// ═══════════════════════════════════════════════
//  {% stepper %} Blocks
// ═══════════════════════════════════════════════

function transformSteppers(content) {
  return content.replace(
    /\{%\s*stepper\s*%\}\n([\s\S]*?)\{%\s*endstepper\s*%\}/g,
    (_m, inner) => {
      let body = inner
        .replace(/\{%\s*step\s*%\}/g, '<Step>')
        .replace(/\{%\s*endstep\s*%\}/g, '</Step>');
      return `<Steps>\n${body.trim()}\n</Steps>`;
    }
  );
}

// ═══════════════════════════════════════════════
//  {% embed %} Blocks
// ═══════════════════════════════════════════════

function transformEmbeds(content) {
  return content.replace(
    /\{%\s*embed\s+url="([^"]+)"\s*%\}/g,
    (_m, url) => `<Embed url="${url}" />`
  );
}

// ═══════════════════════════════════════════════
//  {% openapi %} Blocks
// ═══════════════════════════════════════════════

function transformOpenAPI(content) {
  return content.replace(
    /\{%\s*openapi\s+src="[^"]+"\s+path="([^"]+)"\s+method="([^"]+)"\s*%\}\n?([\s\S]*?)\{%\s*endopenapi\s*%\}/g,
    (_m, path, method, desc) =>
      `### \`${method.toUpperCase()} ${path}\`\n\n${desc.trim()}\n`
  );
}

// ═══════════════════════════════════════════════
//  Card Table Parser
// ═══════════════════════════════════════════════

function transformCardTables(content) {
  return content.replace(
    /<table[^>]*data-view="cards"[^>]*>[\s\S]*?<\/table>/g,
    html => parseCards(html)
  );
}

function parseCards(html) {
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return html;

  const rows = tbodyMatch[1].match(/<tr[\s\S]*?<\/tr>/g);
  if (!rows) return html;

  const cards = [];

  for (const row of rows) {
    const cells = [];
    let cellMatch;
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
    while ((cellMatch = cellRe.exec(row))) cells.push(cellMatch[1].trim());

    const card = { title: '', description: '', href: '' };

    for (const c of cells) {
      const strong = c.match(/<strong>([^<]+)<\/strong>/);
      if (strong && !card.title) { card.title = strong[1]; continue; }

      const linkOnly = c.match(/^<a\s+href="([^"]+)"[^>]*>[^<]*<\/a>$/);
      if (linkOnly && !card.href) { card.href = linkOnly[1]; continue; }

      const btnLink = c.match(/<a\s+href="([^"]+)"[^>]*class="button[^"]*"[^>]*>/);
      if (btnLink && !card.href) { card.href = btnLink[1]; continue; }

      if (c.startsWith('<i ') || c.startsWith('<i>')) continue;

      const plain = c.replace(/<[^>]+>/g, '').trim();
      if (plain && !card.description && !strong) card.description = plain;
    }

    if (card.title) cards.push(card);
  }

  if (!cards.length) return html;

  const elems = cards.map(c => {
    const h = c.href ? ` href="${fixLink(c.href)}"` : '';
    return `<Card title="${c.title}"${h}>\n${c.description}\n</Card>`;
  }).join('\n');

  return `<Cards>\n${elems}\n</Cards>`;
}

// ═══════════════════════════════════════════════
//  Button Anchors
// ═══════════════════════════════════════════════

function transformButtons(content) {
  return content.replace(
    /<a\s[^>]*class="button[^"]*"[^>]*href="([^"]+)"[^>]*>\s*([^<]+?)\s*<\/a>/g,
    (_m, href, text) => `[${text}](${href})`
  );
  // Also handle href before class
}

// ═══════════════════════════════════════════════
//  Link & Image Path Fixer
// ═══════════════════════════════════════════════

function fixLink(href) {
  if (/^(https?:|mailto:|#)/.test(href)) return href;

  let fixed = href;
  fixed = fixed.replace(/\.md(#|$)/, '$1');
  fixed = fixed.replace(/\/README(#|$)/, '/$1');
  fixed = fixed.replace(/^README(#|$)/, './$1');
  return fixed;
}

function transformLinks(content) {
  return content.replace(
    /\[([^\]]*)\]\(([^)]+)\)/g,
    (_m, text, href) => `[${text}](${fixLink(href)})`
  );
}

function transformImages(content) {
  return content.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_m, alt, src) => {
      if (src.startsWith('http')) return _m;
      const fixed = src.replace(/^(\.\.\/)*assets\//, '/assets/');
      return `![${alt}](${fixed})`;
    }
  );
}

function splitPathAndSuffix(href) {
  const m = href.match(/^([^?#]*)([?#].*)?$/);
  return { path: m?.[1] ?? href, suffix: m?.[2] ?? '' };
}

function isRebaseCandidate(href) {
  return !/^(https?:|mailto:|#|\/|\.\.?(\/|$))/.test(href);
}

function rebaseRelativeLinks(content, srcAbs, dstAbs) {
  const srcDir = dirname(relative(ROOT, srcAbs));
  const dstDir = dirname(relative(OUTPUT_DIR, dstAbs));

  const rebaseHref = (href) => {
    const { path, suffix } = splitPathAndSuffix(href);
    if (!path || !isRebaseCandidate(path)) return href;

    const target = join(srcDir, path);
    let next = relative(dstDir, target);
    if (!next || next === '') next = '.';
    return `${next}${suffix}`;
  };

  let c = content.replace(
    /\[([^\]]*)\]\(([^)]+)\)/g,
    (_m, text, href) => `[${text}](${rebaseHref(href)})`
  );

  c = c.replace(
    /href="([^"]+)"/g,
    (_m, href) => `href="${rebaseHref(href)}"`
  );

  return c;
}

// ═══════════════════════════════════════════════
//  MDX Compatibility Fixes
// ═══════════════════════════════════════════════

const KNOWN_TAGS = new Set([
  'Cards','Card','Callout','Tabs','Tab','Steps','Step','Embed',
  'Accordions','Accordion',
  'table','thead','tbody','tr','td','th','a','img','figure','figcaption',
  'strong','em','i','b','u','details','summary','div','span','p','br','hr',
  'code','pre','ul','ol','li','h1','h2','h3','h4','h5','h6',
  'blockquote','sup','sub','del','ins','mark','small','abbr',
]);

function fixMdxCompat(content) {
  // Split into code-fenced segments and non-code segments
  const segments = [];
  let rest = content;
  const fenceRe = /^```[^\n]*\n[\s\S]*?^```$/gm;
  let lastIdx = 0;
  let m;

  while ((m = fenceRe.exec(content))) {
    if (m.index > lastIdx) {
      segments.push({ code: false, text: content.slice(lastIdx, m.index) });
    }
    segments.push({ code: true, text: m[0] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < content.length) {
    segments.push({ code: false, text: content.slice(lastIdx) });
  }

  // Process non-code segments
  const processed = segments.map(seg => {
    if (seg.code) return seg.text;
    let t = seg.text;

    // Multi-line HTML comments → MDX comments
    t = t.replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}');

    // Self-closing <img ...> (not already self-closed)
    t = t.replace(/<img\s([^>]*[^/])>/g, '<img $1 />');

    // Convert inline style="..." strings to JSX style objects
    t = t.replace(/style="([^"]+)"/g, (_m, css) => {
      const props = css.split(';').filter(Boolean).map(p => {
        const [key, ...vals] = p.split(':');
        const k = key.trim().replace(/-([a-z])/g, (_x, c) => c.toUpperCase());
        const v = vals.join(':').trim();
        return `${k}: "${v}"`;
      });
      return `style={{${props.join(', ')}}}`;
    });

    // Escape <= and >= operators in text (not inside backticks)
    t = escapeOutsideBackticks(t, /<=(?!=)/g, '&lt;=');
    t = escapeOutsideBackticks(t, />=(?!=)/g, '&gt;=');

    // Escape < that are NOT known tags
    t = t.replace(/<(\/?)?([A-Za-z][A-Za-z0-9_.-]*)/g, (match, slash, tag, offset) => {
      if (isInsideBackticks(t, offset)) return match;
      const s = slash || '';
      if (KNOWN_TAGS.has(tag)) return match;
      return `&lt;${s}${tag}`;
    });

    // Escape remaining unmatched > that follow our &lt; escapes
    t = t.replace(/&lt;([^<]*?)>/g, (match, inner) => {
      if (inner.includes('<')) return match;
      return `&lt;${inner}&gt;`;
    });

    // Escape { in text that look like object types, e.g. {address: string}
    t = t.replace(/\{(\w+:\s*\w+[^}]*)\}/g, (match, inner, offset) => {
      if (isInsideBackticks(t, offset)) return match;
      return `\\{${inner}\\}`;
    });

    return t;
  });

  return processed.join('');
}

function isInsideBackticks(text, offset) {
  const before = text.slice(0, offset);
  const ticks = (before.match(/`/g) || []).length;
  return ticks % 2 === 1;
}

function escapeOutsideBackticks(text, pattern, replacement) {
  return text.replace(pattern, (match, offset) => {
    if (isInsideBackticks(text, offset)) return match;
    return replacement;
  });
}

function ensureFrontmatter(content, filePath) {
  const hasFm = /^---\n/.test(content);
  if (hasFm) {
    const titleCheck = content.match(/^---\n([\s\S]*?)\n---/);
    if (titleCheck && /^title:/m.test(titleCheck[1])) return content;
  }

  // Extract title from first heading
  const h1 = content.match(/^#\s+(.+)$/m);
  const name = h1 ? h1[1].trim() : basename(filePath, '.mdx').replace(/-/g, ' ');
  const title = name.charAt(0).toUpperCase() + name.slice(1);

  if (hasFm) {
    return content.replace(/^---\n/, `---\ntitle: "${title}"\n`);
  }
  return `---\ntitle: "${title}"\n---\n\n${content}`;
}

// ═══════════════════════════════════════════════
//  Orchestrator — transform a single file
// ═══════════════════════════════════════════════

function migrateFile(srcAbs, dstAbs) {
  const rel = relative(ROOT, srcAbs);
  const relDst = relative(ROOT, dstAbs);
  let c = readFileSync(srcAbs, 'utf8');

  c = resolveIncludes(c, srcAbs);
  c = cleanFrontmatter(c);
  c = transformCodeBlocks(c);
  c = transformHints(c);
  c = transformTabs(c);
  c = transformSteppers(c);
  c = transformEmbeds(c);
  c = transformOpenAPI(c);
  c = transformCardTables(c);
  c = transformButtons(c);
  c = transformLinks(c);
  c = transformImages(c);
  c = rebaseRelativeLinks(c, srcAbs, dstAbs);
  c = fixMdxCompat(c);
  c = ensureFrontmatter(c, relative(ROOT, dstAbs));

  mkdirSync(dirname(dstAbs), { recursive: true });
  writeFileSync(dstAbs, c, 'utf8');
  console.log(`  ${rel} → ${relDst}`);
}

// ═══════════════════════════════════════════════
//  Copy Assets
// ═══════════════════════════════════════════════

function copyDir(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const e of readdirSync(src)) {
    const s = join(src, e), d = join(dst, e);
    statSync(s).isDirectory() ? copyDir(s, d) : copyFileSync(s, d);
  }
}

function copyAssets() {
  console.log('\nCopying assets …');
  if (existsSync(ASSETS_SRC)) copyDir(ASSETS_SRC, ASSETS_DST);
  const gb = join(ROOT, '.gitbook', 'assets');
  if (existsSync(gb)) copyDir(gb, join(ASSETS_DST, 'gitbook'));
  console.log('  done');
}

// ═══════════════════════════════════════════════
//  Generate meta.json Files
// ═══════════════════════════════════════════════

function generateMetaFiles(sections) {
  console.log('\nGenerating meta.json files …');

  const rootPages = [];
  const dirEntries = new Map();
  const topLevelMeta = new Map();

  for (const sec of sections) {
    for (const e of sec.entries) {
      const name = basename(e.path, '.md');
      let dir = dirname(e.path);
      const slug = name === 'README' ? 'index' : name;

      if (dir === '.') {
        if (slug === 'index') {
          dir = getSectionTopDir(sec);
        } else {
          continue;
        }
      }

      const parts = dir.split('/');
      const topDir = parts[0];
      if (!rootPages.includes(topDir)) rootPages.push(topDir);
      if (!topLevelMeta.has(topDir)) {
        topLevelMeta.set(topDir, { title: sec.title, root: true });
      }

      if (!dirEntries.has(dir)) dirEntries.set(dir, []);
      const list = dirEntries.get(dir);
      if (!list.includes(slug)) list.push(slug);

      if (parts.length > 1) {
        const parentDir = parts.slice(0, -1).join('/');
        if (!dirEntries.has(parentDir)) dirEntries.set(parentDir, []);
        const parentList = dirEntries.get(parentDir);
        const childDir = parts[parts.length - 1];
        if (!parentList.includes(childDir)) parentList.push(childDir);
      }
    }
  }

  const writeMeta = (dir, pages, extra = {}) => {
    const p = join(OUTPUT_DIR, dir, 'meta.json');
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify({ ...extra, pages }, null, 2) + '\n', 'utf8');
    console.log(`  ${relative(ROOT, p)}`);
  };

  writeMeta('.', rootPages);

  for (const [dir, pages] of dirEntries) {
    if (!pages.length) continue;
    const extra = !dir.includes('/') ? (topLevelMeta.get(dir) ?? {}) : {};
    writeMeta(dir, pages, extra);
  }
}

function getSectionTopDir(section) {
  const nested = section.entries.find((entry) => dirname(entry.path) !== '.');
  if (nested) return dirname(nested.path).split('/')[0];

  return section.title
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ═══════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════

function main() {
  console.log('GitBook → Fumadocs Migration');
  console.log('═'.repeat(50));

  if (existsSync(OUTPUT_DIR)) {
    rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const sections = parseSummary();
  console.log(`Parsed ${sections.length} sections from SUMMARY.md\n`);

  const files = new Map();

  for (const sec of sections) {
    for (const e of sec.entries) {
      if (e.path === 'README.md') {
        files.set(e.path, join(getSectionTopDir(sec), 'index.mdx'));
        continue;
      }

      const name = basename(e.path, '.md');
      const dir = dirname(e.path);
      const dstName = name === 'README' ? 'index.mdx' : `${name}.mdx`;
      const dst = dir === '.' ? dstName : join(dir, dstName);
      files.set(e.path, dst);
    }
  }

  let ok = 0, skip = 0;

  for (const [src, dst] of files) {
    const srcAbs = join(ROOT, src);
    const dstAbs = join(OUTPUT_DIR, dst);
    if (!existsSync(srcAbs)) {
      console.warn(`  SKIP (missing): ${src}`);
      skip++;
      continue;
    }
    migrateFile(srcAbs, dstAbs);
    ok++;
  }

  copyAssets();
  generateMetaFiles(sections);

  console.log('\n' + '═'.repeat(50));
  console.log(`Done: ${ok} migrated, ${skip} skipped`);
}

main();
