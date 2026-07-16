import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/game/destiny-rules.ts", import.meta.url), "utf8");
const wrap = value => (value - 1) % 6 + 1;

test("uses all six dice in three independent formulas", () => {
  assert.match(source, /values\[0\] \+ values\[2\] \+ values\[4\]/);
  assert.match(source, /values\[1\] \+ values\[3\] \+ values\[5\]/);
  assert.match(source, /values\[0\] \+ values\[1\] \+ values\[2\] \+ values\[3\] \+ 2 \* values\[4\] \+ 2 \* values\[5\]/);
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
  assert.equal(wrap(dice[0] + dice[2] + dice[4]), 3);
  assert.equal(wrap(dice[1] + dice[3] + dice[5]), 2);
  assert.equal(wrap(dice[0] + dice[1] + dice[2] + dice[3] + 2*dice[4] + 2*dice[5]), 6);
});

test("is exactly uniform and jointly independent across all 46,656 rolls", () => {
  const joint = Array(216).fill(0);
  for (let d1=1;d1<=6;d1++) for (let d2=1;d2<=6;d2++) for (let d3=1;d3<=6;d3++)
    for (let d4=1;d4<=6;d4++) for (let d5=1;d5<=6;d5++) for (let d6=1;d6<=6;d6++) {
      const n = wrap(d1+d3+d5) - 1;
      const t = wrap(d2+d4+d6) - 1;
      const d = wrap(d1+d2+d3+d4+2*d5+2*d6) - 1;
      joint[(n*6+t)*6+d]++;
    }
  assert.deepEqual([...new Set(joint)], [216]);
});
