import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/game/scene-navigation.ts", import.meta.url), "utf8");

test("uses named spawn points and ground probes instead of room image coordinates", () => {
  assert.match(source, /from_hallway/);
  assert.match(source, /from_room/);
  assert.match(source, /probeGround/);
  assert.match(source, /resolveSpawn/);
  assert.match(source, /left_wall_and_doorframe/);
  assert.match(source, /validateSceneNavigation/);
});

