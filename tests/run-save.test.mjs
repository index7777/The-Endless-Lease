import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/game/run-save.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const { parseRunSave, serializeRunSave } = await import(moduleUrl);

const sample = {
  residentName: "陳秋蓮",
  destiny: { attributes: [3, 4, 2, 5, 3, 1], gender: "female", identity: "清潔工", talent: "租緩", defect: "貪息", floor: 6, roomSlot: 4 },
  location: "room",
  activeRoom: 4,
  demoEndingState: "B2_ALIVE",
  storage: [{ id: 1, slot: 0, kind: "rent", quantity: 18 }],
  storageCapacity: 5,
  mortgageMarks: [],
  residentLog: ["06:12　回到承租房"],
  game: {
    player: { x: 720, y: 610, hp: 88, stamina: 81, facing: 1, attack: .2, invuln: .4 },
    enemies: [], pickups: [], rent: 12, time: 640, score: 210, day: 2, rentDue: 30,
    settlementTriggered: true, landlordTask: false, taskKills: 0, debtMode: false, arrears: 0,
    rentProtectionLost: false, homeBreachTriggered: false, breachTick: 2, floor: 6, attention: 0,
    visitedRooms: [], floorStates: {}, weaponLevel: 1, medkits: 1, keysOwned: 0, skillCooldown: 0,
    camera: 0, dead: false, debtLedger: [], mortgageLayers: 0, defeatedBosses: [], activeBoss: null,
    phaseIndex: 0, phaseFlash: .5,
  },
};

test("round-trips a versioned run and clears transient combat state", () => {
  const restored = parseRunSave(serializeRunSave(sample, 12345));
  assert.equal(restored.schemaVersion, 1);
  assert.equal(restored.savedAt, 12345);
  assert.equal(restored.residentName, "陳秋蓮");
  assert.equal(restored.game.player.attack, 0);
  assert.equal(restored.game.player.invuln, 0);
  assert.equal(restored.game.settlementTriggered, false);
  assert.equal(restored.game.phaseFlash, 0);
});

test("rejects corrupt, unsupported and structurally invalid saves", () => {
  assert.equal(parseRunSave("not json"), null);
  assert.equal(parseRunSave(JSON.stringify({ schemaVersion: 99 })), null);
  const invalid = JSON.parse(serializeRunSave(sample));
  invalid.destiny.roomSlot = 99;
  assert.equal(parseRunSave(JSON.stringify(invalid)), null);
});
