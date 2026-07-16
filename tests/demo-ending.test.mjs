import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/game/demo-ending.ts", import.meta.url), "utf8");
test("keeps the complete B2 ending state sequence data-driven", () => {
  for (const state of ["B2_ALIVE","B2_DEFEATED","KEYCARD_DROPPED","KEYCARD_COLLECTED","RETURN_TO_OFFICE","KEYCARD_DELIVERED","POST_B2_FREE_ROAM","DEMO_COMPLETED"]) assert.match(source, new RegExp(state));
  assert.match(source, /demo\.b2\.clearance\.title/);
  assert.match(source, /EN TRANSLATION PENDING REVIEW/);
});

