import assert from "node:assert/strict";
import test from "node:test";

import { HOME_BED_RANGE, resolveHomeInteraction } from "../app/game/room-interactions.ts";
import { distanceToEventInteraction, getRandomEvent } from "../app/game/random-events.ts";

test("bed interaction is reachable from the bed's left edge and front span", () => {
  assert.deepEqual(HOME_BED_RANGE, [820, 1340]);
  assert.deepEqual(resolveHomeInteraction(820), { kind: "bed", distance: 0 });
  assert.deepEqual(resolveHomeInteraction(919), { kind: "bed", distance: 0 });
  assert.deepEqual(resolveHomeInteraction(1120), { kind: "bed", distance: 0 });
  assert.deepEqual(resolveHomeInteraction(1340), { kind: "bed", distance: 0 });
  assert.deepEqual(resolveHomeInteraction(720), { kind: "storage", distance: 0 });
});

test("clinic table interaction follows the central treatment bed, not the exit door", () => {
  const clinic = getRandomEvent("resident_clinic");
  assert.equal(distanceToEventInteraction(clinic, 950), 0);
  assert.ok(distanceToEventInteraction(clinic, 260) > 500);
});
