import assert from "node:assert/strict";
import test from "node:test";
import {
  BOSS_COLLISION_RADIUS,
  NORMAL_ENEMY_COLLISION_RADIUS,
  RENT_PURSUER_COLLISION_RADIUS,
  enemyCollisionRadius,
  hasEnemyPlayerClearance,
  isPositionBlockedByEnemy,
  separateEnemyFromPlayer,
} from "../app/game/actor-collision.ts";

const enemy = (overrides = {}) => ({ x: 500, y: 600, hp: 100, phase: 0, location: "hallway", kind: "wall", ...overrides });

test("all enemy classes use scale-appropriate solid collision", () => {
  assert.equal(enemyCollisionRadius(enemy()), NORMAL_ENEMY_COLLISION_RADIUS);
  assert.equal(enemyCollisionRadius(enemy({ kind: "pursuer", elite: true })), RENT_PURSUER_COLLISION_RADIUS);
  assert.equal(enemyCollisionRadius(enemy({ kind: "boss_b1" })), BOSS_COLLISION_RADIUS);
  assert.equal(enemyCollisionRadius(enemy({ kind: "boss_b2" })), BOSS_COLLISION_RADIUS);
});

test("player is blocked above, below and beside every living enemy", () => {
  for (const kind of ["wall", "light", "receipt", "pursuer", "boss_b1", "boss_b2"]) {
    const target = enemy({ kind, elite: kind === "pursuer" });
    assert.equal(isPositionBlockedByEnemy([target], "hallway", null, 500, 570), true, `${kind} blocks from above`);
    assert.equal(isPositionBlockedByEnemy([target], "hallway", null, 500, 630), true, `${kind} blocks from below`);
    assert.equal(isPositionBlockedByEnemy([target], "hallway", null, 530, 600), true, `${kind} blocks from side`);
  }
});

test("enemy remains solid through death animation and releases after it completes", () => {
  const dying = enemy({ hp: 0, deathTimer: 1.2 });
  assert.equal(isPositionBlockedByEnemy([dying], "hallway", null, 500, 600), true);
  dying.deathTimer = 0;
  assert.equal(isPositionBlockedByEnemy([dying], "hallway", null, 500, 600), false);
});

test("separation resolves existing overlap to a legal boundary", () => {
  const boss = enemy({ kind: "boss_b2" });
  const separated = separateEnemyFromPlayer(boss, 500, 600, 500, 600);
  assert.equal(hasEnemyPlayerClearance(boss, separated.x, separated.y, 500, 600), true);
});
