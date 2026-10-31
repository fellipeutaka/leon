#!/usr/bin/env node
// Audits .ts/.tsx files against the shadcn-dream rules in ../dream.md.
// Usage: node dream-audit.mjs [--rules 1,2,3,8] <file-or-dir>...
// Prints one line per violation (file:line [rule] message) and exits 1 if any.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const argv = process.argv.slice(2);

if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
  console.log("Usage: node dream-audit.mjs [--rules 1,2,3,8] <file-or-dir>...");
  console.log("Checks rules 1-8 of dream.md (or only the listed ones). Exits 1 when any violation is found.");
  process.exit(argv.length === 0 ? 1 : 0);
}

const rulesAt = argv.indexOf("--rules");
const RULES = new Set(
  rulesAt === -1 ? ["1", "2", "3", "4", "5", "6", "7", "8"] : argv[rulesAt + 1].split(",")
);
const args = rulesAt === -1 ? argv : argv.filter((_, i) => i !== rulesAt && i !== rulesAt + 1);

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build"]);

function collect(path, out) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (!SKIP_DIRS.has(entry)) collect(join(path, entry), out);
    }
  } else if ([".ts", ".tsx"].includes(extname(path)) && !path.endsWith(".d.ts")) {
    out.push(path);
  }
  return out;
}

const REACT_RUNTIME =
  /\bReact\.(use[A-Z]\w*|createContext|forwardRef|memo|lazy|startTransition|Children|cloneElement|isValidElement|createElement|Fragment|Suspense|StrictMode)\b/g;

// Matches `export function Name(` / `function Name(` and returns the props type
// annotation of the first parameter, or null when the component takes none.
function propsAnnotation(source, openParen) {
  let depth = 0;
  let colon = -1;
  for (let i = openParen; i < source.length; i++) {
    const ch = source[i];
    if ("({[<".includes(ch)) depth++;
    else if (")}]>".includes(ch)) {
      if (ch === ">" && source[i - 1] === "=") continue;
      depth--;
      if (depth === 0) {
        return colon === -1 ? null : source.slice(colon + 1, i).trim();
      }
    } else if (ch === ":" && depth === 1 && colon === -1) {
      colon = i;
    } else if (ch === "," && depth === 1 && colon !== -1) {
      return source.slice(colon + 1, i).trim();
    }
  }
  return null;
}

function audit(file) {
  const source = readFileSync(file, "utf8");
  const lineOf = (index) => source.slice(0, index).split("\n").length;
  const found = [];
  const report = (index, rule, message) => {
    if (RULES.has(rule)) found.push(`${file}:${lineOf(index)} [${rule}] ${message}`);
  };

  for (const m of source.matchAll(
    /import\s+(type\s+)?([^;]*?)\s+from\s+["']([^"']+)["']/g
  )) {
    const [, typeOnly, clause, from] = m;
    const names = clause.replace(/[{}]/g, "").split(",").map((s) => s.trim());
    // Local binding names: `cn as merge` binds `merge`, so lib/cva.ts itself passes.
    const locals = names.map((n) => n.replace(/^type\s+/, "").split(/\s+as\s+/).pop());

    if (from === "class-variance-authority") {
      report(m.index, "1", 'import from "class-variance-authority"; use lib/cva and `cva`');
    }
    if (locals.includes("cn") && !/(^|\/)lib\/cva$/.test(from)) {
      report(m.index, "1", `cn imported from "${from}"; import it from lib/cva`);
    }
    if (from === "cva" && !typeOnly && locals.includes("cva")) {
      report(m.index, "1", 'cva imported from the "cva" package; import it from lib/cva');
    }
    if (/^\*\s+as\s+React$/.test(clause.trim()) && from === "react") {
      report(m.index, "6", "namespace React import; use global React types and named runtime imports");
    } else if (/^\*\s+as\s+\w+$/.test(clause.trim())) {
      report(m.index, "7", `namespace import from "${from}"; use named imports`);
    }
    if (from.startsWith("@radix-ui/react-")) {
      report(m.index, "8", `import from "${from}"; run \`npx shadcn@latest migrate radix\``);
    }
  }

  for (const m of source.matchAll(/\bcva\(\s*["'`]/g)) {
    report(m.index, "2", "positional cva call; use cva({ base, variants, ... })");
  }

  for (const m of source.matchAll(/\bcn\(\s*\w+Variants\(/g)) {
    report(m.index, "3", "cn() wraps a variants call; pass className into the variants call");
  }

  for (const m of source.matchAll(/^export\s+(type\s+)?\{[^}]*\}\s*;?\s*$/gm)) {
    report(m.index, "4", "trailing export block; export at the declaration");
  }

  for (const m of source.matchAll(/^(export\s+)?function\s+([A-Z]\w*)\s*(<[^(]*>)?\(/gm)) {
    const [, exported, name] = m;
    if (!exported) {
      report(m.index, "4", `${name} is not exported at its declaration`);
    }
    const annotation = propsAnnotation(source, m.index + m[0].length - 1);
    if (annotation !== null && !new RegExp(`^${name}Props(<.*>)?$`).test(annotation)) {
      report(m.index, "5", `${name} props typed as \`${annotation.replace(/\s+/g, " ").slice(0, 60)}\`; declare and use export interface ${name}Props`);
    } else if (annotation !== null && !new RegExp(`export\\s+(interface|type)\\s+${name}Props\\b`).test(source)) {
      report(m.index, "5", `${name}Props is not exported`);
    }
  }

  for (const m of source.matchAll(REACT_RUNTIME)) {
    report(m.index, "6", `${m[0]} at runtime; use a named import from "react"`);
  }

  return found;
}

const files = args.flatMap((arg) => collect(arg, []));
const violations = files.flatMap(audit);

for (const line of violations) console.log(line);
console.log(
  violations.length === 0
    ? `dream-audit: ${files.length} file(s) in dream shape`
    : `dream-audit: ${violations.length} violation(s) in ${files.length} file(s)`
);
process.exit(violations.length === 0 ? 0 : 1);
