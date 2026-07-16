import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/game/presentation-profiles.ts", import.meta.url), "utf8");
test("defines shared lighting, time, character and UI profiles", () => {
  for (const token of ["morning","day","evening","night","deep_night","hallway_fluorescent","sampleCharacterExposure","UI_THEME"]) assert.match(source, new RegExp(token));
});

