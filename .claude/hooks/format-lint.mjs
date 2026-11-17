// PostToolUse hook: Prettier on .ts/.tsx/.md, ESLint --fix on TS/TSX.
import { spawnSync } from "node:child_process";
import path from "node:path";

const TS_EXT = new Set([".ts", ".tsx", ".mts", ".cts"]);
const MD_EXT = new Set([".md", ".mdx"]);

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let filePath;
try {
  filePath = JSON.parse(raw)?.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (!filePath) process.exit(0);

const ext = path.extname(filePath).toLowerCase();
const isTs = TS_EXT.has(ext);
if (!isTs && !MD_EXT.has(ext)) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const rel = path.relative(projectDir, path.resolve(projectDir, filePath));
if (rel.startsWith("..") || /(^|[\/])(node_modules|\.next)[\/]/.test(rel)) {
  process.exit(0);
}

const run = (cmd, args) =>
  spawnSync(cmd, args, { cwd: projectDir, shell: true, encoding: "utf8" });
const q = `"${rel}"`;

const pretty = run("npx", ["prettier", "--write", "--log-level", "warn", q]);
if (pretty.status !== 0) {
  process.stderr.write(`Prettier falló en ${rel}:\n${pretty.stderr || pretty.stdout}`);
  process.exit(2);
}

if (isTs) {
  const lint = run("npx", ["eslint", "--fix", q]);
  if (lint.status !== 0) {
    process.stderr.write(`ESLint errores en ${rel}:\n${lint.stdout}${lint.stderr}`);
    process.exit(2);
  }
}
process.exit(0);
