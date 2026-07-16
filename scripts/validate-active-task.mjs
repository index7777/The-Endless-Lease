import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const activePath = resolve(root, "tasks/ACTIVE_TASK.md");
const failures = [];
const warnings = [];
const pass = message => console.log(`PASS｜${message}`);
const fail = message => failures.push(message);

try { await access(activePath); pass("tasks/ACTIVE_TASK.md 存在"); }
catch { fail("tasks/ACTIVE_TASK.md 不存在"); }

const source = await readFile(activePath, "utf8").catch(() => "");
const requiredSections = ["## 任務識別", "## 使用者原始要求", "## 本次必做項目", "## 每項驗收條件", "## 本次禁止修改", "## 已知風險", "## 工作日誌"];
for (const section of requiredSections) source.includes(section) ? pass(section) : fail(`缺少必要章節：${section}`);

const commit = source.match(/起始 Commit：`?([0-9a-f]{40})`?/i)?.[1];
commit ? pass(`起始 Commit：${commit}`) : fail("未填入有效的 40 字元起始 Commit");

const log = source.split("## 工作日誌")[1]?.trim() ?? "";
log && /###\s+/.test(log) ? pass("工作日誌已更新") : fail("工作日誌不存在或未更新");

const itemPattern = /^- \[(TODO|IN_PROGRESS|BLOCKED|NEEDS_REVIEW|VERIFIED|CANCELLED)\] (T\d{2,})：(.+)$/gm;
const items = [...source.matchAll(itemPattern)].map(match => ({ status: match[1], id: match[2], title: match[3] }));
if (!items.length) fail("本次必做項目沒有可解析的 T 編號與狀態");
else pass(`已解析 ${items.length} 個任務項目`);

const unfinished = items.filter(item => !["VERIFIED", "CANCELLED"].includes(item.status));
for (const item of unfinished) fail(`${item.id} 尚未完成：${item.status}｜${item.title}`);

for (const item of items.filter(item => item.status === "VERIFIED")) {
  const sectionStart = source.indexOf(`### ${item.id}`);
  const nextStart = source.indexOf("\n### T", sectionStart + 5);
  const section = source.slice(sectionStart, nextStart < 0 ? source.length : nextStart);
  const evidence = section.match(/^- 驗收證據：\s*(.+)$/m)?.[1]?.trim();
  if (!evidence || /^(無|不適用|待補|TBD|TODO)$/i.test(evidence)) fail(`${item.id} 已標 VERIFIED，但沒有有效的「驗收證據」`);
  else pass(`${item.id} 已填驗收證據`);
}

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    if (["node_modules", ".next", "dist", "work", "reports"].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    else output.push(path);
  }
  return output;
}

const scanRoots = ["app", "assets", "tests", "tools"].map(path => resolve(root, path));
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".css"]);
const placeholderPattern = /\b(?:PROJECT_PLACEHOLDER|FIXME|TBD|TODO:)\b|lorem ipsum|待補內容/gi;
const placeholders = [];
for (const path of (await Promise.all(scanRoots.map(walk))).flat()) {
  if (!textExtensions.has(extname(path).toLowerCase())) continue;
  const text = await readFile(path, "utf8").catch(() => "");
  for (const match of text.matchAll(placeholderPattern)) placeholders.push(`${relative(root, path)}:${text.slice(0, match.index).split("\n").length}｜${match[0]}`);
}
if (placeholders.length) for (const item of placeholders) fail(`未處理 Placeholder：${item}`);
else pass("未發現明確的未處理 Placeholder 標記");

if (warnings.length) for (const message of warnings) console.warn(`WARN｜${message}`);
if (failures.length) {
  for (const message of failures) console.error(`FAIL｜${message}`);
  console.error(`ACTIVE TASK CHECK FAILED：${failures.length} 項`);
  process.exitCode = 1;
} else console.log("ACTIVE TASK CHECK PASS");
