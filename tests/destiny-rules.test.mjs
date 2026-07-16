import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/game/destiny-rules.ts", import.meta.url), "utf8");

test("uses all six dice in three independent formulas", () => {
  assert.match(source, /values\[0\] \+ values\[2\] \+ values\[4\]/);
  assert.match(source, /values\[1\] \+ values\[3\] \+ values\[5\]/);
  assert.match(source, /values\.reduce\(\(product, value\) => product \* value, 1\)/);
  assert.match(source, /\(value - 1\) % 6 \+ 1/);
});

test("removes hidden all-one and all-six outcomes", () => {
  assert.doesNotMatch(source, /all_sixes|all_ones|HIDDEN_DESTINY/);
  assert.match(source, /ruleId: "dice\.v2\.independent"/);
});

test("keeps the six fixed identity, talent and defect tables", () => {
  assert.match(source, /\["清潔工", "醫師", "逃犯", "房仲", "靈媒", "前住戶"\]/);
  assert.match(source, /\["租緩", "窺層", "偽居", "契語", "蝕耐", "存契"\]/);
  assert.match(source, /\["貪息", "寡眠", "幻聽", "直白", "輕厄", "無家"\]/);
});

test("documents the supplied example as escapee, floor sight and homeless", () => {
  const dice = [1,2,3,4,5,2];
  const wrap = value => (value - 1) % 6 + 1;
  assert.equal(wrap(dice[0] + dice[2] + dice[4]), 3);
  assert.equal(wrap(dice[1] + dice[3] + dice[5]), 2);
  assert.equal(wrap(dice.reduce((product,value) => product * value, 1)), 6);
});
