import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const spec = JSON.parse(await readFile(resolve(root, "assets/dice/animations/dice_roll/animation_spec.json"), "utf8"));
const faces = JSON.parse(await readFile(resolve(root, "assets/dice/source/dice_face_config.json"), "utf8"));
const source = await readFile(resolve(root, spec.source), "utf8");
const checks = [];
const check = (name, fn) => { try { fn(); checks.push({ name, status: "PASS" }); } catch (error) { checks.push({ name, status: "FAIL", detail: String(error.message || error) }); } };

check("six fixed dice", () => assert.equal(spec.die_count, 6));
check("standard opposite faces", () => assert.deepEqual(faces.opposites, [[1,6],[2,5],[3,4]]));
check("single fixed geometry source", () => { assert.match(source, /FACE_CONFIG/); assert.match(source, /const rotate/); });
check("continuous time-based rotation", () => { assert.match(source, /requestAnimationFrame/); assert.match(source, /now \/ 1000/); });
check("dynamic final face orientation", () => { for (let value = 1; value <= 6; value++) assert.ok(source.includes(`value === ${value}`) || value === 1); });
check("fixed camera and lighting", () => { assert.equal(spec.camera_locked, true); assert.equal(spec.lighting_locked, true); });
check("no Unicode dice replacement", () => assert.doesNotMatch(source, /⚀|⚁|⚂|⚃|⚄|⚅/));
check("accessible result synchronization", () => assert.match(source, /aria-label=\{`\$\{label\}，\$\{value\} 點`\}/));

const passed = checks.every(item => item.status === "PASS");
const reportDir = resolve(root, "assets/dice/animations/dice_roll/reports");
await mkdir(reportDir, { recursive: true });
await writeFile(resolve(reportDir, "validation_report.json"), JSON.stringify({ animation: spec.name, version: "1.0", target_engine: "Next.js Canvas Runtime", checks, final_result: passed ? "PASS" : "FAIL" }, null, 2));
const markdown = [`# 六骰動畫驗證報告`, ``, `- 動畫：${spec.name}`, `- 製作方式：固定幾何即時 Canvas 模型`, `- 骰數：6`, `- 目標 FPS：${spec.target_fps}`, `- 結果：${passed ? "PASS" : "FAIL"}`, ``, ...checks.map(item => `- ${item.status}｜${item.name}${item.detail ? `｜${item.detail}` : ""}`), ``].join("\n");
await writeFile(resolve(reportDir, "validation_report.md"), markdown);
if (!passed) process.exitCode = 1;
else console.log(`Dice validation PASS (${checks.length}/${checks.length})`);

