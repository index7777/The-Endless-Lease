import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GAME_DAY_SECONDS,
  getTimePeriod,
  getTimePeriodIndex,
  getTimePeriodLabel,
  isPatrolLightManifested,
  isPatrolLightPeriod,
  TIME_PERIOD_ORDER,
  TIME_PERIOD_PROFILES,
} from "../app/game/presentation-profiles.ts";

test("uses exactly the four production time periods over the 30-minute day", () => {
  assert.equal(GAME_DAY_SECONDS, 1800);
  assert.deepEqual(TIME_PERIOD_ORDER, ["daylight", "evening", "curfew_night", "uncanny_dawn"]);
  assert.equal(getTimePeriod(1800), "daylight");
  assert.equal(getTimePeriod(1201), "daylight");
  assert.equal(getTimePeriod(1200), "evening");
  assert.equal(getTimePeriod(751), "evening");
  assert.equal(getTimePeriod(750), "curfew_night");
  assert.equal(getTimePeriod(226), "curfew_night");
  assert.equal(getTimePeriod(225), "uncanny_dawn");
  assert.equal(getTimePeriod(0), "uncanny_dawn");
  assert.deepEqual([1800, 1200, 750, 225].map(getTimePeriodIndex), [0, 1, 2, 3]);
  assert.deepEqual([1800, 1200, 750, 225].map(getTimePeriodLabel), ["白晝", "黃昏", "宵禁深夜", "臨晨詭時"]);
});

test("gives every period a distinct scene-lighting profile", () => {
  const profiles = TIME_PERIOD_ORDER.map(period => TIME_PERIOD_PROFILES[period]);
  assert.equal(new Set(profiles.map(profile => JSON.stringify(profile))).size, 4);
  assert.ok(profiles[0].exposure > profiles[1].exposure);
  assert.ok(profiles[1].exposure > profiles[2].exposure);
  assert.ok(profiles[2].exposure > profiles[3].exposure);
  assert.ok(profiles[0].practicalIntensity > profiles[3].practicalIntensity);
  assert.ok(profiles[0].outageChance < profiles[3].outageChance);
});

test("removes the obsolete five-period and 720-second visual clock", async () => {
  const source = await readFile(new URL("../app/game/presentation-profiles.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /"morning"|"night"|"deep_night"|720 - secondsRemaining/);
});

test("allows patrol-light remnants only during curfew night and uncanny dawn", () => {
  assert.equal(isPatrolLightPeriod(1201), false);
  assert.equal(isPatrolLightPeriod(1200), false);
  assert.equal(isPatrolLightPeriod(751), false);
  assert.equal(isPatrolLightPeriod(750), true);
  assert.equal(isPatrolLightPeriod(226), true);
  assert.equal(isPatrolLightPeriod(225), true);
  assert.equal(isPatrolLightPeriod(0), true);
});

test("patrol-light visibility flickers while alive but remains visible after death", () => {
  const samples = Array.from({ length: 160 }, (_, index) => isPatrolLightManifested(index * 25, 2.2, 75, 500));
  assert.ok(samples.includes(true));
  assert.ok(samples.includes(false));
  assert.equal(isPatrolLightManifested(0, 2.2, 75, 1200), false);
  assert.equal(isPatrolLightManifested(0, 2.2, 0, 500), true);
});
