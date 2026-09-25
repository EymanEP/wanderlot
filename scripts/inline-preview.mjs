// Folds a Vite build (index.html + assets) into one HTML fragment with the CSS
// and JS inline, for publishing as a single shareable page.
// usage: node scripts/inline-preview.mjs <buildDir> <out.html>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [dir, out] = process.argv.slice(2);
if (!dir || !out) throw new Error("usage: inline-preview.mjs <buildDir> <out.html>");
const html = readFileSync(join(dir, "index.html"), "utf8");
const title = /<title>(.*?)<\/title>/.exec(html)?.[1] ?? "Wanderlot";
const fonts = [...html.matchAll(/<link[^>]+fonts\.googleapis\.com\/css2[^>]*>/g)].map((m) => m[0]);
const css = [...html.matchAll(/<link[^>]+href="\/?(assets\/[^"]+\.css)"[^>]*>/g)].map((m) => readFileSync(join(dir, m[1]), "utf8"));
const js = [...html.matchAll(/<script[^>]+src="\/?(assets\/[^"]+\.js)"[^>]*><\/script>/g)].map((m) => readFileSync(join(dir, m[1]), "utf8"));
// Keep "</script>" inside the bundle from closing the inline tag.
const safe = (s) => s.replace(/<\/script/gi, "<\\/script");

writeFileSync(
  out,
  [
    `<title>${title}</title>`,
    `<link rel="preconnect" href="https://fonts.googleapis.com">`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
    ...fonts,
    `<style>${css.join("\n")}</style>`,
    `<div id="root"></div>`,
    ...js.map((s) => `<script type="module">${safe(s)}</script>`),
  ].join("\n"),
);
console.log(`${out}: ${(readFileSync(out).length / 1024).toFixed(0)} KB`);
