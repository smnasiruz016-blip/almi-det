// RR-400 · text-contrast gate. Pure node, so CI can run it. The brand tokens (coral #FF7A6B, coral-deep #ff6b5b, teal #0d9488,
// gold-deep, accent-deep) are fill colours: as TEXT on the cream page they measured 2.5–3.7:1 and Lighthouse accessibility fell to 96.
// globals.css therefore sets a darker, text-only shade for each `text-almi-*` class in its "RR-400 text shades" block.
// RED when: a brand text class used in src/ has no text shade in that block, or a shade is below WCAG AA 4.5:1 on any light
// background the site paints (white, cream, peach, and every brand token at 10/15/20% over white and over cream, e.g. the
// `bg-almi-teal/15` chip). Run: node scripts/gates/text-contrast.mjs
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CSS = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
const fails = [];
const ok = (c, n) => { if (!c) fails.push(n); console.log(`  [${c ? "PASS" : "FAIL"}] ${n}`); };

const hex = (h) => { h = h.replace("#", ""); if (h.length === 3) h = [...h].map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, g, b] = hex(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (fg, bg, a) => "#" + hex(fg).map((c, i) => Math.round(a * c + (1 - a) * hex(bg)[i]).toString(16).padStart(2, "0")).join("");

/* the theme tokens, read from @theme */
const token = (name) => CSS.match(new RegExp(`--color-almi-${name}:\\s*(#[0-9a-fA-F]{3,6})`))?.[1];
const BRAND = ["coral", "coral-deep", "teal", "gold-deep", "accent-deep", "accent", "gold"].map(token).filter(Boolean);
const PAGE = ["#ffffff", token("bg") ?? "#fffbf5", token("bg-peach") ?? "#ffe8d6"];
const BGS = [...PAGE];
for (const t of BRAND) for (const base of PAGE.slice(0, 2)) for (const a of [0.1, 0.15, 0.2]) BGS.push(mix(t, base, a));

/* the text shades: `.text-almi-x, .text-almi-y { color: #hex; }` inside the RR-400 block */
const block = CSS.split("RR-400 text shades")[1] ?? "";
ok(block.length > 0, 'globals.css has the "RR-400 text shades" block');
const shade = {};
for (const m of block.matchAll(/((?:\.text-almi-[a-z-]+\s*,?\s*)+)\{\s*color:\s*(#[0-9a-fA-F]{3,6})/g))
  for (const c of m[1].matchAll(/\.text-almi-([a-z-]+)/g)) shade[c[1]] = m[2];

/* every brand text class the site uses must have a shade */
const walk = (d) => !existsSync(d) ? [] : readdirSync(d).flatMap((n) => { const f = join(d, n); const s = statSync(f); return s.isDirectory() ? walk(f) : /\.(tsx|ts|jsx)$/.test(n) ? [f] : []; });
const used = new Set();
for (const f of walk(join(ROOT, "src"))) for (const m of readFileSync(f, "utf8").matchAll(/(?<![:\w-])text-almi-(coral-deep|coral|teal|gold-deep|accent-deep)(?![\w/-])/g)) used.add(m[1]);
for (const name of [...used].sort()) {
  const c = shade[name];
  ok(Boolean(c), `text-almi-${name} has a text shade`);
  if (!c) continue;
  const worst = BGS.map((b) => [b, ratio(c, b)]).sort((p, q) => p[1] - q[1])[0];
  ok(worst[1] >= 4.5, `text-almi-${name} ${c} is at least 4.5:1 on every light background (worst ${worst[1].toFixed(2)} on ${worst[0]})`);
}
console.log(fails.length ? `\nTEXT CONTRAST GATE FAIL (${fails.length})` : "\nTEXT CONTRAST GATE PASS");
process.exitCode = fails.length ? 1 : 0;
