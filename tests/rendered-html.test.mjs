import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta = /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the Traditional Chinese game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="zh-Hant">/i);
  assert.match(html, /<title>無期租寓/);
  assert.match(html, /class="game-shell is-menu"/);
  assert.match(html, /入住登記/);
  assert.match(html, /入住規約/);
  assert.match(html, /租寓管理室/);
  assert.match(html, /入住通知單已送達/);
  assert.match(html, /清除 B1、B2 底層異常源/);
  assert.match(html, /付得起租金，活得像人/);
  assert.doesNotMatch(html, developmentPreviewMeta);
  assert.doesNotMatch(html, /Codex is working|Your site is taking shape|react-loading-skeleton/i);
});

test("ships the demo scene and character assets", async () => {
  const [game, model, globals, layout, publicFiles] = await Promise.all([
    readFile(new URL("../app/game.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/model.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readdir(new URL("../public/", import.meta.url)),
  ]);
  for (const asset of ["scene-title-v2.png", "scene-hallway-v1.png", "scene-home-v1.png", "scene-elevator-v1.png", "scene-elevator-b1-v2.png", "scene-b1-maintenance-v1.png", "scene-b2-records-v1.png", "scene-clinic-v2.png", "sprite-player-v1.png", "sprite-player-female-v1.png", "sprite-player-walk-v1.png", "sprite-player-walk-transition-v2.png", "sprite-player-female-walk-transition-v2.png", "sprite-player-attack-v1.png", "sprite-player-attack-windup-v2.png", "sprite-player-female-attack-windup-v2.png", "sprite-player-death-v1.png", "sprite-boss-b1-v2.png", "sprite-boss-b1-attack-v2.png", "sprite-boss-b2-v1.png", "sprite-boss-b2-attack-v2.png", "sprite-wall-resident-attack-v2.png", "sprite-rent-pursuer-attack-v2.png", "pickup-rent-v1.png", "pickup-medicine-v1.png", "pickup-key-v1.png", "pickup-equipment-v1.png", "sprite-wall-resident-v1.png", "sprite-light-warden-v1.png", "sprite-receipt-collector-v1.png", "sprite-rent-pursuer-v1.png"]) {
    assert.ok(publicFiles.includes(asset), `missing ${asset}`);
    assert.match(`${game}\n${globals}`, new RegExp(asset.replace(".", "\\.")));
  }
  assert.match(layout, /無期租寓/);
  assert.match(model, /gender:\s*"male"\s*\|\s*"female"/);
  assert.match(game, /destiny\.gender === "female"/);
  assert.match(game, /DIE_FACE_GLYPHS/);
  assert.match(game, /ATTRIBUTE_NAMES\.map\(\(name,index\)=>/);
  assert.match(game, /本輪住戶姓名/);
  assert.match(game, /交付通知單/);
  assert.match(game, /擲出裁定/);
  assert.match(game, /HONG_YI_LINES\.registrationComplete/);
  assert.match(game, /setFilingStage\("ready"\); dispatchFlow\(\{ type: "RESTART" \}\)/);
  assert.match(globals, /\.elevator-console\s*\{[^}]*pointer-events\s*:\s*auto|\.settlement-paper[^}]*\.elevator-console\s*\{\s*pointer-events\s*:\s*auto/);
  assert.doesNotMatch(game, /NT\$/);
  assert.doesNotMatch(game, /_sites-preview|SkeletonPreview/);
});
