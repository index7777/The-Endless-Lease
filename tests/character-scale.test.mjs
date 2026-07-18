import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/game/characterScale.ts", import.meta.url), "utf8");
const game = await readFile(new URL("../app/game.tsx", import.meta.url), "utf8");

test("角色尺度使用 256 px 成人與 312 px 標準門", () => {
  assert.match(source, /STANDARD_DOOR_HEIGHT_PX = 312/);
  assert.match(source, /STANDARD_ADULT_HEIGHT_PX = 256/);
  assert.match(source, /player: \{ renderHeightPx: 256/);
  assert.match(source, /normalAdultNpc: \{ renderHeightPx: 256/);
});

test("遊戲渲染由集中角色尺度表取得高度", () => {
  assert.match(game, /getCharacterRenderHeightPx\("player"\)/);
  assert.match(game, /getCharacterRenderHeightPx\(enemyRole\)/);
  assert.doesNotMatch(game, /boss_b1" \? 248/);
  assert.doesNotMatch(game, /isBoss \? 342 : e\.elite \? 294 : 268/);
});
