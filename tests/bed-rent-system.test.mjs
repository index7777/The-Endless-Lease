import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  advanceToNextDay,
  checkCanSleep,
  debtTotal,
  hasOutstandingRent,
  payAllOutstandingRentToHongYi,
  settleDailyRent,
} from "../app/game/bed-rent-system.ts";

const runtime = (overrides = {}) => ({
  player: { x: 1000, y: 600, hp: 35, stamina: 50, facing: 1, attack: 0, invuln: 0 },
  enemies: [], pickups: [], rent: 100, time: 360, score: 0, day: 1, rentDue: 40,
  overdueDays: 0, settlementTriggered: false, landlordTask: false, taskKills: 0,
  debtMode: false, arrears: 0, rentProtectionLost: false, homeBreachTriggered: false,
  breachTick: 2, floor: 3, attention: 0, visitedRooms: [], floorStates: {}, weaponLevel: 1,
  medkits: 0, keysOwned: 0, skillCooldown: 0, camera: 0, dead: false, debtLedger: [],
  mortgageLayers: 0, defeatedBosses: [], activeBoss: null, phaseIndex: 0, phaseFlash: 0,
  ...overrides,
});

const sleepInput = (overrides = {}) => ({
  isInPlayerRoom: true,
  isInCombat: false,
  isPlayerIncapacitated: false,
  isCutsceneActive: false,
  isSceneTransitioning: false,
  isDayTransitioning: false,
  outstandingRentDebt: 0,
  ...overrides,
});

test("TEST-BED-001 restores full health, advances one day and settles once", () => {
  const game = runtime();
  const result = advanceToNextDay(game, { reason: "sleep", restoreFullHealth: true, maxHealth: 91, nextDailyRent: 45, createdAt: 1 });
  assert.equal(game.player.hp, 91);
  assert.equal(game.day, 2);
  assert.equal(game.time, 720);
  assert.equal(game.rent, 60);
  assert.equal(game.rentDue, 45);
  assert.equal(result.settlement.amountPaid, 40);
  assert.equal(result.settlement.debtAdded, 0);
});

test("TEST-BED-002 every rest time advances exactly once without changing rent", () => {
  for (const time of [715, 540, 360, 180, 1]) {
    const game = runtime({ time });
    const result = advanceToNextDay(game, { reason: "sleep", restoreFullHealth: true, maxHealth: 80, nextDailyRent: 40, createdAt: time });
    assert.equal(game.day, 2);
    assert.equal(game.time, 720);
    assert.equal(result.settlement.rentAmount, 40);
    assert.equal(game.rent, 60);
  }
});

test("TEST-BED-003 debt blocks rest and exposes the exact reason without mutation", () => {
  const game = runtime({ rent: 125, time: 420, debtLedger: [{ dayId: 1, originalRent: 180, remainingBalance: 180, interestApplied: false, createdAt: 1 }] });
  const before = structuredClone(game);
  assert.deepEqual(checkCanSleep(sleepInput({ outstandingRentDebt: debtTotal(game.debtLedger) })), { allowed: false, reason: "rent_overdue" });
  assert.deepEqual(game, before);
  assert.equal(hasOutstandingRent(game), true);
});

test("sleep eligibility rejects every transient unsafe state", () => {
  for (const [field, reason] of [
    ["isInPlayerRoom", "not_in_player_room"],
    ["isInCombat", "in_combat"],
    ["isPlayerIncapacitated", "player_incapacitated"],
    ["isCutsceneActive", "cutscene_active"],
    ["isSceneTransitioning", "scene_transition"],
    ["isDayTransitioning", "day_transition_active"],
  ]) {
    const value = field === "isInPlayerRoom" ? false : true;
    assert.deepEqual(checkCanSleep(sleepInput({ [field]: value })), { allowed: false, reason });
  }
  assert.deepEqual(checkCanSleep(sleepInput()), { allowed: true });
});

test("daily rent is atomic: sufficient funds pay all, insufficient funds pay zero and add all", () => {
  const paid = runtime({ rent: 40, rentDue: 40 });
  assert.deepEqual(settleDailyRent(paid, 1), { rentAmount: 40, paymentSucceeded: true, amountPaid: 40, debtAdded: 0, totalOutstandingDebt: 0 });
  assert.equal(paid.rent, 0);

  const overdue = runtime({ rent: 39, rentDue: 40 });
  assert.deepEqual(settleDailyRent(overdue, 2), { rentAmount: 40, paymentSucceeded: false, amountPaid: 0, debtAdded: 40, totalOutstandingDebt: 40 });
  assert.equal(overdue.rent, 39);
  assert.equal(overdue.overdueDays, 1);
});

test("TEST-DAY-001 natural and sleep use the same settlement; only sleep restores health", () => {
  const natural = runtime({ rent: 0, player: { ...runtime().player, hp: 12 } });
  const slept = structuredClone(natural);
  const naturalResult = advanceToNextDay(natural, { reason: "natural", restoreFullHealth: false, maxHealth: 90, nextDailyRent: 40, createdAt: 1 });
  const sleepResult = advanceToNextDay(slept, { reason: "sleep", restoreFullHealth: true, maxHealth: 90, nextDailyRent: 40, createdAt: 1 });
  assert.deepEqual(naturalResult.settlement, sleepResult.settlement);
  assert.equal(natural.player.hp, 12);
  assert.equal(slept.player.hp, 90);
});

test("TEST-RENT-002/003 insufficient Hong-Yi payment changes nothing and never pays partially", () => {
  const game = runtime({ rent: 125, overdueDays: 1, arrears: 180, debtMode: true, rentProtectionLost: true, debtLedger: [{ dayId: 2, originalRent: 180, remainingBalance: 180, interestApplied: false, createdAt: 1 }] });
  const before = structuredClone(game);
  const result = payAllOutstandingRentToHongYi(game, { current: false }, () => assert.fail("must not persist"));
  assert.deepEqual(result, { success: false, failureReason: "insufficient_funds" });
  assert.deepEqual(game, before);
});

test("TEST-RENT-004/006 Hong-Yi pays all once and resets derived bed access", () => {
  const game = runtime({ rent: 500, overdueDays: 2, arrears: 180, debtMode: true, rentProtectionLost: true, debtLedger: [{ dayId: 2, originalRent: 180, remainingBalance: 180, interestApplied: false, createdAt: 1 }] });
  const lock = { current: false };
  let saves = 0;
  assert.deepEqual(payAllOutstandingRentToHongYi(game, lock, () => saves++), { success: true, amountPaid: 180, remainingMoney: 320 });
  assert.deepEqual(payAllOutstandingRentToHongYi(game, lock, () => saves++), { success: false, failureReason: "no_outstanding_debt" });
  assert.equal(game.rent, 320);
  assert.equal(game.overdueDays, 0);
  assert.equal(hasOutstandingRent(game), false);
  assert.equal(saves, 1);
});

test("transaction lock and failed persistence prevent double charge or split state", () => {
  const debt = [{ dayId: 2, originalRent: 180, remainingBalance: 180, interestApplied: false, createdAt: 1 }];
  const locked = runtime({ rent: 500, debtLedger: structuredClone(debt) });
  assert.deepEqual(payAllOutstandingRentToHongYi(locked, { current: true }, () => {}), { success: false, failureReason: "payment_in_progress" });
  assert.equal(locked.rent, 500);

  const rollback = runtime({ rent: 500, overdueDays: 1, arrears: 180, debtMode: true, rentProtectionLost: true, debtLedger: structuredClone(debt) });
  assert.deepEqual(payAllOutstandingRentToHongYi(rollback, { current: false }, () => { throw new Error("quota"); }), { success: false, failureReason: "persistence_failed" });
  assert.equal(rollback.rent, 500);
  assert.equal(debtTotal(rollback.debtLedger), 180);
});

test("formal UI exposes payment only through Hong-Yi and stores no bedLocked flag", async () => {
  const gameSource = await readFile(new URL("../app/game.tsx", import.meta.url), "utf8");
  const coreSource = await readFile(new URL("../app/game/bed-rent-system.ts", import.meta.url), "utf8");
  assert.match(gameSource, /管理員・紅怡/);
  assert.match(gameSource, /confirmHongYiPayment/);
  assert.doesNotMatch(`${gameSource}\n${coreSource}`, /bedLocked|sleepPrivilegeSuspended/);
  assert.doesNotMatch(gameSource, /resolveRent|payPartialRent|confirmPartialPayment/);
});
