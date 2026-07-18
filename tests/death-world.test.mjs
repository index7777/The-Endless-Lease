import assert from "node:assert/strict";
import test from "node:test";
import { advanceDeadWorldClock, detachEnemiesFromDeadPlayer } from "../app/game/death-world.ts";

const runtime = () => ({
  player: { x: 100, y: 100, hp: 0, stamina: 50, facing: 1, attack: .3, invuln: .8 },
  enemies: [{ x: 200, y: 100, hp: 100, phase: 0, location: "hallway", kind: "boss_b2", aiState: "chase", attackTimer: .5, attackCooldown: 1, combatSeen: true }],
  pickups: [], rent: 12, time: .2, score: 0, day: 3, rentDue: 99,
  settlementTriggered: true, landlordTask: false, taskKills: 0, debtMode: true, arrears: 99,
  rentProtectionLost: true, homeBreachTriggered: true, breachTick: .1, floor: -1, attention: 4,
  visitedRooms: [], floorStates: {}, weaponLevel: 1, medkits: 0, keysOwned: 0, skillCooldown: 0,
  camera: 0, dead: true, debtLedger: [{ dayId: 3, originalRent: 99, remainingBalance: 99, interestApplied: false, createdAt: 1 }],
  mortgageLayers: 0, defeatedBosses: ["boss_b1"], activeBoss: "boss_b2", phaseIndex: 0, phaseFlash: 0,
});

test("death detaches every living enemy from player combat", () => {
  const game = runtime();
  detachEnemiesFromDeadPlayer(game);
  const boss = game.enemies[0];
  assert.equal(boss.aiState, "patrol");
  assert.equal(boss.attackTimer, 0);
  assert.equal(boss.attackCooldown, 0);
  assert.equal(boss.combatSeen, false);
  assert.equal(boss.patrolAnchorX, 200);
});

test("dead world clock crosses days without rent settlement or pursuit mutation", () => {
  const game = runtime();
  const rentBefore = game.rent;
  const debtBefore = structuredClone(game.debtLedger);
  const elapsed = advanceDeadWorldClock(game, .5, 720);
  assert.equal(elapsed, 1);
  assert.equal(game.day, 4);
  assert.equal(game.time, 719.7);
  assert.equal(game.rent, rentBefore);
  assert.deepEqual(game.debtLedger, debtBefore);
  assert.equal(game.settlementTriggered, false);
  assert.equal(game.breachTick, 2);
  assert.equal(game.player.hp, 0);
});
