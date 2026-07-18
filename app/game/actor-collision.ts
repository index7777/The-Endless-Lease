import type { Enemy, Location } from "./model";

export const BOSS_COLLISION_RADIUS = 100;
export const NORMAL_ENEMY_COLLISION_RADIUS = 60;
export const RENT_PURSUER_COLLISION_RADIUS = 68;
// Actor coordinates represent their feet. The previous value made the
// collision ellipse too shallow vertically, allowing visual overlap when the
// player approached a tall enemy from above.
export const BOSS_COLLISION_Y_SCALE = .9;

export function isBossEnemy(enemy: Enemy) {
  return enemy.kind === "boss_b1" || enemy.kind === "boss_b2";
}

export function isBossSolid(enemy: Enemy) {
  return isBossEnemy(enemy) && (enemy.hp > 0 || (enemy.deathTimer ?? 0) > 0);
}

export function isEnemySolid(enemy: Enemy) {
  return enemy.hp > 0 || (enemy.deathTimer ?? 0) > 0;
}

export function enemyCollisionRadius(enemy: Enemy) {
  if (isBossEnemy(enemy)) return BOSS_COLLISION_RADIUS;
  if (enemy.kind === "pursuer" || enemy.elite) return RENT_PURSUER_COLLISION_RADIUS;
  return NORMAL_ENEMY_COLLISION_RADIUS;
}

export function bossCollisionDistance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, (ay - by) * BOSS_COLLISION_Y_SCALE);
}

export function isPositionBlockedByBoss(
  enemies: readonly Enemy[],
  location: Location,
  roomSlot: number | null,
  x: number,
  y: number,
) {
  return enemies.some(enemy => isBossSolid(enemy)
    && enemy.location === location
    && (location !== "room" || enemy.roomSlot === roomSlot)
    && bossCollisionDistance(x, y, enemy.x, enemy.y) < BOSS_COLLISION_RADIUS);
}

export function isPositionBlockedByEnemy(
  enemies: readonly Enemy[],
  location: Location,
  roomSlot: number | null,
  x: number,
  y: number,
) {
  return enemies.some(enemy => isEnemySolid(enemy)
    && enemy.location === location
    && (location !== "room" || enemy.roomSlot === roomSlot)
    && bossCollisionDistance(x, y, enemy.x, enemy.y) < enemyCollisionRadius(enemy));
}

export function hasBossPlayerClearance(bossX: number, bossY: number, playerX: number, playerY: number) {
  return bossCollisionDistance(bossX, bossY, playerX, playerY) >= BOSS_COLLISION_RADIUS;
}

export function hasEnemyPlayerClearance(enemy: Enemy, enemyX: number, enemyY: number, playerX: number, playerY: number) {
  return bossCollisionDistance(enemyX, enemyY, playerX, playerY) >= enemyCollisionRadius(enemy);
}

export function separateBossFromPlayer(bossX: number, bossY: number, playerX: number, playerY: number) {
  const dx = bossX - playerX;
  const scaledY = (bossY - playerY) * BOSS_COLLISION_Y_SCALE;
  const distance = Math.hypot(dx, scaledY);
  if (distance >= BOSS_COLLISION_RADIUS) return { x: bossX, y: bossY };
  const fallbackX = distance < .001 ? BOSS_COLLISION_RADIUS : dx * (BOSS_COLLISION_RADIUS / distance);
  const fallbackScaledY = distance < .001 ? 0 : scaledY * (BOSS_COLLISION_RADIUS / distance);
  return { x: playerX + fallbackX, y: playerY + fallbackScaledY / BOSS_COLLISION_Y_SCALE };
}

export function separateEnemyFromPlayer(enemy: Enemy, enemyX: number, enemyY: number, playerX: number, playerY: number) {
  const radius = enemyCollisionRadius(enemy);
  const dx = enemyX - playerX;
  const scaledY = (enemyY - playerY) * BOSS_COLLISION_Y_SCALE;
  const distance = Math.hypot(dx, scaledY);
  if (distance >= radius) return { x: enemyX, y: enemyY };
  const separatedX = distance < .001 ? radius : dx * (radius / distance);
  const separatedScaledY = distance < .001 ? 0 : scaledY * (radius / distance);
  return { x: playerX + separatedX, y: playerY + separatedScaledY / BOSS_COLLISION_Y_SCALE };
}
