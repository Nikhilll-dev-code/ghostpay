import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../apps/web/src/", import.meta.url));
const ALLOWED_HYPHEN_TERMS = ["What-If Lab"];
const ALLOWED_SPACING = new Set(["0", "0.5", "1", "2", "3", "4", "6", "8", "10", "12", "16", "20", "24"]);
const SPACING_CLASS = /(?<![\w-])(?:[a-z]+:)*(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y)-(\d+(?:\.\d+)?)(?![\w.])/g;
const ARBITRARY_SPACING = /(?<![\w-])(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y)-\[/g;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "test" ? [] : walk(full);
    return /\.(tsx?|css)$/.test(name) ? [full] : [];
  });
}

const problems = [];
const report = (file, message) => problems.push(`${relative(root, file)}: ${message}`);

function stripAllowed(text) {
  return ALLOWED_HYPHEN_TERMS.reduce((acc, term) => acc.split(term).join(""), text);
}

function visibleStrings(source) {
  const found = [];
  for (const match of source.matchAll(/(?<![=-])>\s*([^<>{}=\n][^<>{}]*?)\s*</g)) found.push(match[1]);
  for (const match of source.matchAll(/\b(?:title|aria-label|placeholder|label|description|hint)=\"([^\"]+)\"/g)) found.push(match[1]);
  for (const match of source.matchAll(/\b(?:label|description|title|hint):\s*\"([^\"]+)\"/g)) found.push(match[1]);
  for (const match of source.matchAll(/\b(?:q|a|body):\s*\"([^\"]+)\"/g)) found.push(match[1]);
  return found;
}

for (const file of walk(root)) {
  const source = readFileSync(file, "utf8");
  const isCss = file.endsWith(".css");

  for (const m of source.matchAll(SPACING_CLASS)) if (!ALLOWED_SPACING.has(m[1])) report(file, `off scale spacing class "${m[0]}"`);
  for (const m of source.matchAll(ARBITRARY_SPACING)) report(file, `arbitrary spacing class "${m[0]}"`);
  for (const m of source.matchAll(/text-\[\d+px\]/g)) report(file, `arbitrary text size "${m[0]}"`);
  for (const m of source.matchAll(/(?<![\w-])(italic|font-black|font-extrabold)(?![\w-])/g)) report(file, `forbidden style "${m[0]}"`);
  if (/lucide-react/.test(source)) report(file, "lucide-react import is not allowed, use the Phosphor icon module");
  if (/\b(alert|prompt|confirm)\(/.test(source) && !isCss) report(file, "browser alert, prompt or confirm call");

  if (/bg-gradient|from-\w|via-\w|to-\w/.test(source) && !isCss) report(file, "gradient background utility");
  if (isCss) {
    const gradients = source.match(/linear-gradient|radial-gradient|conic-gradient/g) || [];
    const allowed = (source.match(/\.gradient-heading[\s\S]*?background-image:\s*linear-gradient/g) || []).length;
    if (gradients.length > allowed) report(file, "gradient used outside the gradient heading text style");
  }

  if (!isCss) {
    for (const text of visibleStrings(source)) {
      const cleaned = stripAllowed(text);
      if (!/[A-Za-z]/.test(cleaned)) continue;
      if (/;|=>|\)\s*,|\(\s*"/.test(cleaned)) continue;
      if (/[A-Za-z]-[A-Za-z]/.test(cleaned) || /\s-\s/.test(cleaned)) report(file, `hyphen in visible copy: "${text.trim().slice(0, 70)}"`);
    }
  }
}

if (problems.length > 0) {
  console.error(`Design check failed with ${problems.length} problem(s):`);
  problems.forEach((p) => console.error(` - ${p}`));
  process.exit(1);
}
console.log("Design check passed: spacing scale, type, icons, gradients and copy rules are clean.");
