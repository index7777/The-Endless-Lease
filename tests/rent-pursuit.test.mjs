import assert from "node:assert/strict";
import test from "node:test";

import { getRentPursuitWave } from "../app/game/rent-pursuit.ts";

test("doubles every new pursuit wave without a gameplay cap", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(debtCount => getRentPursuitWave(debtCount).count), [1, 2, 4, 8, 16]);
});

test("raises threat with the number of unpaid debt entries", () => {
  assert.deepEqual([1, 2, 3, 4].map(debtCount => getRentPursuitWave(debtCount).threat), [1, 2, 3, 4]);
});
