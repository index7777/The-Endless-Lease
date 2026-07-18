import type { GameRuntime } from "./model";
import { BOSS_BALANCE } from "./game-balance.ts";

export function resetUndefeatedBossAfterEscape(runtime: GameRuntime) {
  const boss = runtime.activeBoss;
  if (!boss || runtime.defeatedBosses.includes(boss)) return false;
  runtime.enemies = runtime.enemies.filter(enemy => enemy.kind !== boss);
  return true;
}

export function bossMaxHealth(boss: "boss_b1" | "boss_b2") {
  return BOSS_BALANCE[boss].maxHp;
}
