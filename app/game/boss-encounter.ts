import type { GameRuntime } from "./model";
import { BOSS_BALANCE } from "./game-balance.ts";

export type BossResetPoint = { x: number; y: number };

export function resetUndefeatedBossAfterEscape(runtime: GameRuntime, origin: BossResetPoint) {
  const boss = runtime.activeBoss;
  if (!boss || runtime.defeatedBosses.includes(boss)) return false;
  const enemy = runtime.enemies.find(candidate => candidate.kind === boss);
  if (!enemy) return false;
  const maxHp = bossMaxHealth(boss);
  enemy.hp = maxHp;
  enemy.maxHp = maxHp;
  enemy.x = origin.x;
  enemy.y = origin.y;
  enemy.location = "hallway";
  enemy.roomSlot = undefined;
  enemy.aiState = "patrol";
  enemy.patrolAnchorX = origin.x;
  enemy.patrolAnchorY = origin.y;
  enemy.patrolTargetX = undefined;
  enemy.patrolTargetY = undefined;
  enemy.patrolWait = 0;
  enemy.attackTimer = 0;
  enemy.attackCooldown = 0;
  enemy.attackLanded = false;
  enemy.combatSeen = false;
  enemy.moving = false;
  enemy.hitTimer = 0;
  return true;
}

export function bossMaxHealth(boss: "boss_b1" | "boss_b2") {
  return BOSS_BALANCE[boss].maxHp;
}
