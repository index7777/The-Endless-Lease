import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/game/flow-state.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const { INITIAL_GAME_FLOW, gameFlowReducer } = await import(moduleUrl);

const reduce = (state, ...actions) => actions.reduce(gameFlowReducer, state);

test("follows the only valid entry and restart path", () => {
  const run = reduce(
    INITIAL_GAME_FLOW,
    { type: "OPEN_INTRO" },
    { type: "OPEN_DESTINY" },
    { type: "START_RUN" },
  );
  assert.equal(run.screen, "run");
  const dead = gameFlowReducer(run, { type: "DIE" });
  assert.deepEqual(gameFlowReducer(dead, { type: "RESTART" }), {
    screen: "destiny", paused: false, overlay: { kind: "none" },
  });
});

test("rejects out-of-order screen transitions", () => {
  assert.equal(gameFlowReducer(INITIAL_GAME_FLOW, { type: "START_RUN" }), INITIAL_GAME_FLOW);
  assert.equal(gameFlowReducer(INITIAL_GAME_FLOW, { type: "OPEN_DESTINY" }), INITIAL_GAME_FLOW);
});

test("returns from destiny to the residency registration form", () => {
  const intro = gameFlowReducer(INITIAL_GAME_FLOW, { type: "OPEN_INTRO" });
  const destiny = gameFlowReducer(intro, { type: "OPEN_DESTINY" });
  assert.equal(gameFlowReducer(destiny, { type: "RETURN_REGISTRATION" }).screen, "intro");
  assert.equal(gameFlowReducer(intro, { type: "RETURN_REGISTRATION" }), intro);
});

test("restores a saved run only from the title", () => {
  const restored = gameFlowReducer(INITIAL_GAME_FLOW, { type: "RESTORE_RUN" });
  assert.deepEqual(restored, { screen: "run", paused: false, overlay: { kind: "none" } });
  assert.equal(gameFlowReducer(restored, { type: "RESTORE_RUN" }), restored);
});

test("keeps run overlays mutually exclusive and lets settlement take priority", () => {
  const run = reduce(INITIAL_GAME_FLOW, { type: "OPEN_INTRO" }, { type: "OPEN_DESTINY" }, { type: "START_RUN" });
  const storage = gameFlowReducer(run, { type: "OPEN_OVERLAY", overlay: { kind: "storage" } });
  assert.equal(gameFlowReducer(storage, { type: "OPEN_OVERLAY", overlay: { kind: "floorSelect" } }), storage);
  assert.deepEqual(gameFlowReducer(storage, { type: "OPEN_OVERLAY", overlay: { kind: "settlement" } }).overlay, { kind: "settlement" });
});

test("does not pause behind an overlay or close a newer overlay with a stale action", () => {
  const run = reduce(INITIAL_GAME_FLOW, { type: "OPEN_INTRO" }, { type: "OPEN_DESTINY" }, { type: "START_RUN" });
  const event = gameFlowReducer(run, { type: "OPEN_OVERLAY", overlay: { kind: "roomEvent", roomId: 2 } });
  assert.equal(gameFlowReducer(event, { type: "TOGGLE_PAUSE" }), event);
  const settlement = gameFlowReducer(event, { type: "OPEN_OVERLAY", overlay: { kind: "settlement" } });
  assert.equal(gameFlowReducer(settlement, { type: "CLOSE_OVERLAY", kind: "roomEvent" }), settlement);
});

test("completes the demo only from a live run and can start a new resident", () => {
  const run = reduce(INITIAL_GAME_FLOW, { type: "OPEN_INTRO" }, { type: "OPEN_DESTINY" }, { type: "START_RUN" });
  assert.equal(gameFlowReducer(INITIAL_GAME_FLOW, { type: "COMPLETE_DEMO" }), INITIAL_GAME_FLOW);
  const complete = gameFlowReducer(run, { type: "COMPLETE_DEMO" });
  assert.deepEqual(complete, { screen: "complete", paused: false, overlay: { kind: "none" } });
  assert.deepEqual(gameFlowReducer(complete, { type: "RESTART" }), {
    screen: "destiny", paused: false, overlay: { kind: "none" },
  });
  assert.deepEqual(gameFlowReducer(complete, { type: "RETURN_TITLE" }), INITIAL_GAME_FLOW);
  assert.equal(gameFlowReducer(run, { type: "RETURN_TITLE" }), run);
});
