import { inflateSync } from "node:zlib";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(resolve(root, "assets/characters/animation-validator.config.json"), "utf8"));
const strictAll = process.argv.includes("--strict");
const strictCandidates = strictAll || process.argv.includes("--strict-candidates");
const posix = path => relative(root, path).replaceAll("\\", "/");

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    else output.push(path);
  }
  return output;
}

function pngMetrics(buffer) {
  if (buffer.toString("hex", 0, 8) !== "89504e470d0a1a0a") throw new Error("不是 PNG");
  let cursor = 8;
  let ihdr;
  const idat = [];
  while (cursor < buffer.length) {
    const length = buffer.readUInt32BE(cursor);
    const type = buffer.toString("ascii", cursor + 4, cursor + 8);
    const data = buffer.subarray(cursor + 8, cursor + 8 + length);
    if (type === "IHDR") ihdr = data;
    if (type === "IDAT") idat.push(data);
    cursor += length + 12;
    if (type === "IEND") break;
  }
  if (!ihdr) throw new Error("缺少 IHDR");
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const interlace = ihdr[12];
  const channels = ({ 0: 1, 2: 3, 4: 2, 6: 4 })[colorType];
  if (bitDepth !== 8 || !channels || interlace !== 0) return { width, height, analyzable: false };

  const packed = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  let sourceOffset = 0;
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = packed[sourceOffset++];
    for (let x = 0; x < stride; x++) {
      const raw = packed[sourceOffset++];
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      const value = filter === 0 ? raw
        : filter === 1 ? raw + left
        : filter === 2 ? raw + up
        : filter === 3 ? raw + Math.floor((left + up) / 2)
        : filter === 4 ? raw + paeth(left, up, upLeft)
        : NaN;
      if (!Number.isFinite(value)) throw new Error(`不支援的 PNG filter ${filter}`);
      pixels[y * stride + x] = value & 255;
    }
  }

  let minX = width, minY = height, maxX = -1, maxY = -1, luminance = 0, opaqueCount = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = y * stride + x * channels;
    const alpha = colorType === 6 ? pixels[offset + 3] : colorType === 4 ? pixels[offset + 1] : 255;
    if (alpha < 16) continue;
    let r, g, b;
    if (colorType === 0 || colorType === 4) r = g = b = pixels[offset];
    else [r, g, b] = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    luminance += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    opaqueCount++;
  }
  return {
    width, height, analyzable: true,
    opaqueBounds: opaqueCount ? { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 } : null,
    brightness: opaqueCount ? luminance / opaqueCount : null
  };
}

const check = (checks, name, passed, detail = "") => checks.push({ name, status: passed ? "PASS" : "FAIL", detail });

async function validateManifest(path) {
  const manifest = JSON.parse(await readFile(path, "utf8"));
  const checks = [];
  const clips = Array.isArray(manifest.clips) ? manifest.clips : [];
  const states = new Set(clips.map(clip => clip.state));
  const scale = config.referenceScale;
  check(checks, "固定成人顯示高度", Math.abs(manifest.renderHeightPx - scale.adultRenderHeightPx) <= scale.renderHeightTolerancePx, `目前 ${manifest.renderHeightPx ?? "未填"} px；基準 ${scale.adultRenderHeightPx} px`);
  check(checks, "腳底中心 Pivot", manifest.pivot === "feet-center", `目前 ${manifest.pivot ?? "未填"}`);
  for (const field of ["groundLine", "footLock", "rootMotionChecked", "collisionBoxChecked"]) check(checks, field, manifest[field] === true);
  check(checks, "統一引擎橢圓陰影", manifest.engineShadow?.type === "ellipse" && manifest.engineShadow?.opacity === 0.25);
  for (const state of config.requiredStates) check(checks, `Animation State：${state}`, states.has(state));

  if (manifest.characterId === "hongyi") check(checks, "紅怡動作速度 50%", manifest.animationSpeedRatio === 0.5);
  if (manifest.characterType === "monster") check(checks, "怪物 Move/Pause 節奏", manifest.movementCadence === "move-pause");
  if (manifest.characterType === "rent-pursuer") {
    check(checks, "追租者只能走路", manifest.locomotion === "walk-only");
    check(checks, "追租者比玩家快 5%", manifest.playerSpeedRatio === 1.05);
  }

  const referencedFrames = [];
  for (const clip of clips) {
    const frames = Array.isArray(clip.frames) ? clip.frames : [];
    referencedFrames.push(...frames.map(frame => resolve(root, frame)));
    const idleMinimum = clip.state === "Idle" && manifest.characterType === "npc" ? config.minimumFrames.NpcIdle : config.minimumFrames[clip.state];
    if (idleMinimum) check(checks, `${clip.state} 最低幀數`, frames.length >= idleMinimum, `${frames.length}/${idleMinimum}`);
    if (["monster", "rent-pursuer", "boss"].includes(manifest.characterType)) check(checks, `${clip.state} 怪物 FPS`, clip.fps >= config.minimumMonsterFps, `${clip.fps ?? 0}/${config.minimumMonsterFps}`);
    if (clip.state === "Attack") check(checks, "Attack 四階段", config.requiredAttackPhases.every(phase => clip.phases?.includes(phase)), (clip.phases ?? []).join(", "));
    check(checks, `${clip.state} Pivot 數量`, Array.isArray(clip.pivots) && clip.pivots.length === frames.length, `${clip.pivots?.length ?? 0}/${frames.length}`);

    const metrics = [];
    for (const frame of frames) {
      try { metrics.push(pngMetrics(await readFile(resolve(root, frame)))); }
      catch (error) { check(checks, `${clip.state} 讀取 ${frame}`, false, String(error.message || error)); }
    }
    if (metrics.length === frames.length && metrics.length > 1 && metrics.every(item => item.analyzable && item.opaqueBounds)) {
      const bottoms = metrics.map(item => item.opaqueBounds.maxY);
      const heights = metrics.map(item => item.opaqueBounds.height);
      const brightness = metrics.map(item => item.brightness);
      const spread = values => Math.max(...values) - Math.min(...values);
      check(checks, `${clip.state} Ground 漂移`, spread(bottoms) <= config.maximumGroundDriftPx, `${spread(bottoms)} px`);
      check(checks, `${clip.state} 輪廓高度突變`, spread(heights) / Math.max(...heights) <= config.maximumFrameHeightDeltaRatio, `${(spread(heights) / Math.max(...heights)).toFixed(3)}`);
      check(checks, `${clip.state} 亮度一致`, spread(brightness) <= config.maximumBrightnessDelta, spread(brightness).toFixed(3));
    }
    if (Array.isArray(clip.pivots) && clip.pivots.length > 1) {
      const xs = clip.pivots.map(pivot => pivot.x), ys = clip.pivots.map(pivot => pivot.y);
      const drift = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      check(checks, `${clip.state} Pivot 漂移`, drift <= config.maximumPivotDriftPx, `${drift} px`);
    }
  }
  const accepted = checks.length > 0 && checks.every(item => item.status === "PASS");
  return { characterId: manifest.characterId ?? basename(path, ".json"), characterType: manifest.characterType ?? "unknown", releaseCandidate: manifest.releaseCandidate === true, manifest: posix(path), result: accepted ? "Accepted" : "Rejected", checks, referencedFrames };
}

const manifestFiles = (await walk(resolve(root, config.manifestDirectory))).filter(path => extname(path).toLowerCase() === ".json");
const characters = [];
for (const path of manifestFiles) {
  try { characters.push(await validateManifest(path)); }
  catch (error) { characters.push({ characterId: basename(path, ".json"), releaseCandidate: true, manifest: posix(path), result: "Rejected", checks: [{ name: "Manifest 可解析", status: "FAIL", detail: String(error.message || error) }], referencedFrames: [] }); }
}

const referenced = new Set(characters.flatMap(item => item.referencedFrames).map(path => resolve(path).toLowerCase()));
const legacyFiles = (await walk(resolve(root, config.legacySpriteDirectory))).filter(path => /^sprite-.*\.png$/i.test(basename(path)));
const legacy = legacyFiles.filter(path => !referenced.has(resolve(path).toLowerCase())).map(path => {
  let dimensions = "未知";
  try { const buffer = requireBuffer(path); dimensions = `${buffer.readUInt32BE(16)}×${buffer.readUInt32BE(20)}`; } catch {}
  return { asset: posix(path), dimensions, result: "Rejected", usage: "Prototype Only", reason: "未註冊角色動畫 Manifest；單張 AI 圖不是 Animation Clip" };
});

function requireBuffer(path) {
  // Legacy 尺寸只需 PNG IHDR；同步讀取可避免在 map 內建立大量 Promise。
  const fs = globalThis.process.getBuiltinModule("node:fs");
  return fs.readFileSync(path);
}

const rejectedCandidates = characters.filter(item => item.releaseCandidate && item.result === "Rejected");
const finalResult = characters.some(item => item.result === "Rejected") || legacy.length ? "Rejected" : "Accepted";
const report = {
  validator: "The Endless Lease 2.5D Animation Validator",
  version: config.version,
  generatedAt: new Date().toISOString(),
  finalResult,
  policy: "AI 圖片只可作為 Animation Source；正式候選必須通過全部檢查",
  characters: characters.map(({ referencedFrames, ...item }) => item),
  legacyAssets: legacy
};
const reportDirectory = resolve(root, config.reportDirectory);
await mkdir(reportDirectory, { recursive: true });
await writeFile(resolve(reportDirectory, "validation_report.json"), JSON.stringify(report, null, 2));
const markdown = [
  "# 《無期租寓》2.5D Animation Validator 報告", "",
  `- 最終狀態：${finalResult}`,
  `- 正式候選：${characters.length}`,
  `- 未註冊舊素材：${legacy.length}`,
  "- 規則：AI 圖片只可作為 Animation Source；任一檢查失敗即 Rejected。", "",
  ...characters.flatMap(item => [`## ${item.characterId}｜${item.result}`, "", ...item.checks.map(entry => `- ${entry.status}｜${entry.name}${entry.detail ? `｜${entry.detail}` : ""}`), ""]),
  "## 未註冊舊素材（Prototype Only）", "",
  ...legacy.map(item => `- Rejected｜${item.asset}｜${item.dimensions}｜${item.reason}`), ""
].join("\n");
await writeFile(resolve(reportDirectory, "validation_report.md"), markdown);

console.log(`Animation validation ${finalResult}: ${characters.length} manifests, ${legacy.length} legacy assets rejected`);
if (strictAll && finalResult === "Rejected") process.exitCode = 1;
else if (strictCandidates && rejectedCandidates.length) process.exitCode = 1;
