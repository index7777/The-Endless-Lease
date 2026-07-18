import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BOSS_BALANCE,
  ITEM_BALANCE,
  ITEM_DEFINITIONS,
  RESIDENTIAL_FLOOR_BASE_RENT,
  calculateDailyRent,
  enemyCombatBalance,
  enemyDamage,
  floorMonsterCap,
  floorPickupCount,
  initialFloorMonsterCount,
  medicineHealing,
  monsterRentDrop,
  pickupTypeForRoll,
  playerAttackDamagePerSecond,
  playerAttackDurationSeconds,
  playerAttackStaminaCost,
  pursuerHealth,
} from "../app/game/game-balance.ts";
import { createFloorState } from "../app/game/floor-generation.ts";

test("rent balance is centralized and preserves the existing floor formula", () => {
  assert.equal(calculateDailyRent(1, 0, 0), 12);
  assert.equal(calculateDailyRent(3, 0, 0), 17);
  assert.equal(calculateDailyRent(9, 0, 0), 36);
  assert.equal(RESIDENTIAL_FLOOR_BASE_RENT[4], 18.96);
  assert.equal(calculateDailyRent(9, 2, 4), Math.ceil((10 + 1.8 * 9 + .11 * 81) * 1.12 * .9));
  for (let floor = 1; floor <= 9; floor++) for (let attention = 0; attention <= 10; attention++) for (let negotiation = 1; negotiation <= 6; negotiation++) {
    const legacy = Math.ceil((10 + 1.8 * floor + .11 * floor * floor) * (1 + attention * .06) * (1 - Math.min(.2, negotiation * .025)));
    assert.equal(calculateDailyRent(floor, attention, negotiation), legacy, `${floor}F attention ${attention} negotiation ${negotiation}`);
  }
});

test("floor generation count and pickup probabilities stay data-driven", () => {
  assert.equal(floorMonsterCap(1), 6);
  assert.equal(initialFloorMonsterCount(1, () => 0), 2);
  assert.equal(initialFloorMonsterCount(1, () => .999), 4);
  assert.equal(floorPickupCount(() => 0), 2);
  assert.equal(floorPickupCount(() => .999), 4);
  assert.equal(pickupTypeForRoll(1, .01), "裝備");
  assert.equal(pickupTypeForRoll(1, .2), "藥品");
  assert.equal(pickupTypeForRoll(1, .5), "鑰匙");
  assert.equal(pickupTypeForRoll(1, .8), "租券");
  const floor = createFloorState(3, 1, 720, () => .5);
  assert.equal(floor.enemies.length, 3);
  assert.equal(floor.pickups.length, 3);
});

test("enemy, boss, pursuit and drop values come from one balance source", () => {
  assert.equal(enemyCombatBalance("wall").damage, 14);
  assert.equal(enemyCombatBalance("receipt").speed, 145);
  assert.equal(enemyCombatBalance("boss_b2").chaseDistance, 620);
  assert.equal(enemyDamage({ kind: "pursuer", elite: true, threat: 3 }), 16);
  assert.equal(pursuerHealth(2, 1), 167);
  assert.equal(BOSS_BALANCE.boss_b1.maxHp, 420);
  assert.equal(BOSS_BALANCE.boss_b2.maxHp, 680);
  assert.equal(monsterRentDrop({ elite: false }, 3, 3), 7);
  assert.equal(monsterRentDrop({ elite: true, threat: 2 }, 3, 3), 10);
});

test("item abilities preserve medicine, key, weapon and attack behavior", () => {
  assert.equal(medicineHealing(false), 38);
  assert.equal(medicineHealing(true), 55);
  assert.equal(ITEM_BALANCE.keyScore, 12);
  assert.equal(ITEM_BALANCE.weaponScore, 30);
  assert.equal(ITEM_BALANCE.weaponMaxLevel, 3);
  assert.equal(playerAttackDamagePerSecond(1), 146);
  assert.equal(playerAttackDamagePerSecond(3), 202);
  assert.equal(playerAttackDurationSeconds(), 16 / 24);
  assert.equal(playerAttackStaminaCost(3), 13);
  assert.equal(playerAttackStaminaCost(10), 8);
  assert.equal(ITEM_BALANCE.weaponGrowthMode, "flat_per_level");
  assert.equal(ITEM_DEFINITIONS.裝備.category, "weapon_upgrade");
});

test("game runtime consumes centralized balance instead of retaining duplicate formulas", async () => {
  const source = await readFile(new URL("../app/game.tsx", import.meta.url), "utf8");
  for (const reference of ["calculateDailyRent", "createFloorState", "enemyCombatBalance", "enemyAttackBalance", "enemyDamage", "monsterRentDrop", "medicineHealing", "playerAttackDamagePerSecond", "playerAttackDurationSeconds", "playerAttackStaminaCost"]) assert.match(source, new RegExp(reference));
  for (const duplicate of [/10 \+ 1\.8 \* floor/, /42 \+ floor \* 4/, /75 \+ threat \* 38/, /118 \+ g\.weaponLevel \* 28/, /g\.score \+= 30/, /p\.attack = 16 \/ 24/]) assert.doesNotMatch(source, duplicate);
});
