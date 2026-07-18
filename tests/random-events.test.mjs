import assert from "node:assert/strict";
import test from "node:test";

import { createRandomEventAssignments, findAssignedRandomEvent, RANDOM_EVENT_REGISTRY } from "../app/game/random-events.ts";

test("a new residency assigns every registered event to a unique reachable non-leased room", () => {
  const assignments = createRandomEventAssignments(3, 4, () => .42);
  assert.equal(assignments.length, RANDOM_EVENT_REGISTRY.length);
  assert.equal(new Set(assignments.map(item => `${item.floor}:${item.slot}`)).size, assignments.length);
  assert.ok(assignments.every(item => item.floor >= 1 && item.floor <= 6));
  assert.ok(assignments.every(item => item.floor !== 3 || item.slot !== 4));
  assert.deepEqual(new Set(assignments.map(item => item.eventId)), new Set(RANDOM_EVENT_REGISTRY.map(event => event.id)));
});

test("assigned room keeps its event definition after resolution so the room does not disappear", () => {
  const assignments = [{ eventId: "sealed_wall", floor: 4, slot: 5 }];
  assert.equal(findAssignedRandomEvent(assignments, 4, 5)?.id, "sealed_wall");
});

test("all current events bind a scene, prompt record, interaction range, collision and entrance direction", () => {
  for (const event of RANDOM_EVENT_REGISTRY) {
    assert.match(event.sceneAsset, /^\/scene-/);
    assert.match(event.promptDocument, /^docs\/scenes\//);
    assert.ok(event.interactionRange[0] < event.interactionRange[1]);
    assert.ok(event.collisionProfile);
    assert.deepEqual(event.entrance, { side: "left", handleSide: "right" });
  }
});
