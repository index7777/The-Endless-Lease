import assert from "node:assert/strict";
import test from "node:test";
import { bossMaxHealth, resetUndefeatedBossAfterEscape } from "../app/game/boss-encounter.ts";

const runtime = () => ({
  activeBoss: "boss_b2",
  defeatedBosses: ["boss_b1"],
  enemies: [
    { kind: "boss_b2", hp: 217, maxHp: 680, location: "hallway", x: 500, y: 400, phase: 0 },
    { kind: "pursuer", hp: 80, maxHp: 80, location: "hallway", x: 700, y: 400, phase: 0 },
  ],
});

test("leaving an undefeated B2 encounter discards its damaged runtime instance", () => {
  const game = runtime();
  assert.equal(resetUndefeatedBossAfterEscape(game), true);
  assert.equal(game.enemies.some(enemy => enemy.kind === "boss_b2"), false);
  assert.equal(game.enemies.some(enemy => enemy.kind === "pursuer"), true);
  assert.equal(bossMaxHealth("boss_b2"), 680);
});

test("re-entered bosses use their full canonical health", () => {
  assert.equal(bossMaxHealth("boss_b1"), 420);
  assert.equal(bossMaxHealth("boss_b2"), 680);
});

test("cleared bosses are not treated as abandoned live encounters", () => {
  const game = runtime();
  game.defeatedBosses.push("boss_b2");
  assert.equal(resetUndefeatedBossAfterEscape(game), false);
  assert.equal(game.enemies[0].hp, 217);
});
