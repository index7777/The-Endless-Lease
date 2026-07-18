import type { GameRuntime } from "./model";

export function detachEnemiesFromDeadPlayer(runtime: GameRuntime) {
  for (const enemy of runtime.enemies) {
    if (enemy.hp <= 0) continue;
    enemy.attackTimer = 0;
    enemy.attackCooldown = 0;
    enemy.attackLanded = false;
    enemy.combatSeen = false;
    enemy.aiState = "patrol";
    enemy.patrolAnchorX = enemy.x;
    enemy.patrolAnchorY = enemy.y;
    enemy.patrolTargetX = undefined;
    enemy.patrolTargetY = undefined;
    enemy.patrolWait = 0;
    enemy.moving = false;
  }
}

export function advanceDeadWorldClock(runtime: GameRuntime, deltaSeconds: number, dayDuration: number) {
  const safeDuration = Math.max(1, dayDuration);
  runtime.time -= Math.max(0, deltaSeconds);
  let elapsedDays = 0;
  while (runtime.time <= 0) {
    runtime.time += safeDuration;
    runtime.day += 1;
    elapsedDays += 1;
  }
  // A dead resident no longer has a payable daily settlement or an active home breach.
  runtime.settlementTriggered = false;
  runtime.breachTick = 2;
  runtime.player.hp = 0;
  runtime.player.attack = 0;
  runtime.player.invuln = 0;
  return elapsedDays;
}
