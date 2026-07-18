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

test("leaving an undefeated B2 encounter restores it at its origin", () => {
  const game = runtime();
  assert.equal(resetUndefeatedBossAfterEscape(game, { x: 520, y: 774 }), true);
  const boss = game.enemies.find(enemy => enemy.kind === "boss_b2");
  assert.equal(boss.hp, 680);
  assert.equal(boss.maxHp, 680);
  assert.equal(boss.x, 520);
  assert.equal(boss.y, 774);
  assert.equal(boss.aiState, "patrol");
  assert.equal(boss.attackTimer, 0);
  assert.equal(boss.combatSeen, false);
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
  assert.equal(resetUndefeatedBossAfterEscape(game, { x: 520, y: 774 }), false);
  assert.equal(game.enemies[0].hp, 217);
});
