import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/game/demo-ending.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const { canAccessDemoFloor } = await import(moduleUrl);
test("keeps the complete B2 ending state sequence data-driven", () => {
  for (const state of ["B2_ALIVE","B2_DEFEATED","KEYCARD_DROPPED","KEYCARD_COLLECTED","RETURN_TO_OFFICE","KEYCARD_DELIVERED","POST_B2_FREE_ROAM","DEMO_COMPLETED"]) assert.match(source, new RegExp(state));
  assert.match(source, /demo\.b2\.clearance\.title/);
  assert.match(source, /EN TRANSLATION PENDING REVIEW/);
});

test("allows lower residential floors and caps upward exploration at three floors above the lease", () => {
  assert.deepEqual(
    Array.from({ length: 9 }, (_, index) => index + 1).filter(floor => canAccessDemoFloor(floor, 1, "B2_ALIVE")),
    [1, 2, 3, 4],
  );
  assert.deepEqual(
    Array.from({ length: 9 }, (_, index) => index + 1).filter(floor => canAccessDemoFloor(floor, 5, "KEYCARD_COLLECTED")),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.deepEqual(
    Array.from({ length: 9 }, (_, index) => index + 1).filter(floor => canAccessDemoFloor(floor, 9, "CLEARANCE_REPORT_VIEWED")),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
});

test("never treats event or special floors as part of the residential range", () => {
  assert.equal(canAccessDemoFloor(0, 1, "B2_ALIVE"), false);
  assert.equal(canAccessDemoFloor(-1, 1, "KEYCARD_COLLECTED"), false);
  assert.equal(canAccessDemoFloor(10, 9, "CLEARANCE_REPORT_VIEWED"), false);
});

