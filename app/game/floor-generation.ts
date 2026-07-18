import { GAME_DAY_SECONDS, isPatrolLightPeriod } from "./presentation-profiles.ts";
import type { Enemy, FloorState, Pickup } from "./model";
import {
  FLOOR_GENERATION_BALANCE,
  elapsedAwayMonsterStats,
  elapsedDayMonsterStats,
  floorPickupCount,
  initialFloorMonsterCount,
  initialMonsterStats,
  pickupTypeForRoll,
} from "./game-balance.ts";

export function distributedSpawnXs(count: number, min: number, max: number, separation: number, random: () => number = Math.random) {
  const result: number[] = [];
  for (let index = 0; index < count; index++) {
    let candidate = min + random() * (max - min);
    for (let retry = 0; retry < 24 && result.some(value => Math.abs(value - candidate) < separation); retry++) candidate = min + random() * (max - min);
    result.push(Math.round(candidate));
  }
  return result;
}

export function createFloorState(floor: number, day: number, secondsRemaining = GAME_DAY_SECONDS, random: () => number = Math.random): FloorState {
  const enemyCount = initialFloorMonsterCount(floor, random);
  const enemyXs = distributedSpawnXs(enemyCount, FLOOR_GENERATION_BALANCE.monsterSpawnMinX, FLOOR_GENERATION_BALANCE.monsterSpawnMaxX, FLOOR_GENERATION_BALANCE.monsterSpawnSeparation, random);
  const ordinaryKinds = isPatrolLightPeriod(secondsRemaining) ? (["wall", "light", "receipt"] as const) : (["wall", "receipt"] as const);
  const enemies: Enemy[] = Array.from({ length: enemyCount }, (_, index) => {
    const y = Math.round(300 + random() * 190);
    const stats = initialMonsterStats(floor, random);
    return { x: enemyXs[index], y, ...stats, phase: random() * 6, location: "hallway", followsIndoors: false, kind: ordinaryKinds[index % ordinaryKinds.length] };
  });
  const pickupCount = floorPickupCount(random);
  const positions = distributedSpawnXs(pickupCount, FLOOR_GENERATION_BALANCE.pickupSpawnMinX, FLOOR_GENERATION_BALANCE.pickupSpawnMaxX, FLOOR_GENERATION_BALANCE.pickupSpawnSeparation, random);
  const pickups: Pickup[] = Array.from({ length: pickupCount }, (_, index) => {
    const roll = random();
    return { x: positions[index], y: Math.round(310 + random() * 185), type: pickupTypeForRoll(floor, roll), taken: false };
  });
  return { enemies, pickups, visitedRooms: [], lastSpawnDay: day };
}

export function createElapsedDayEnemy(floor: number, day: number, index: number, secondsRemaining: number, random: () => number = Math.random): Enemy {
  const kinds = isPatrolLightPeriod(secondsRemaining) ? (["wall", "light", "receipt"] as const) : (["wall", "receipt"] as const);
  return { x: 520 + random() * 980, y: random() > .5 ? 470 : 310, ...elapsedDayMonsterStats(floor, day), phase: random() * 6, location: "hallway", followsIndoors: false, kind: kinds[index % kinds.length] };
}

export function createAwayElapsedEnemy(floor: number, elapsedDays: number, index: number, secondsRemaining: number, random: () => number = Math.random): Enemy {
  const kinds = isPatrolLightPeriod(secondsRemaining) ? (["wall", "light", "receipt"] as const) : (["wall", "receipt"] as const);
  return { x: 520 + random() * 980, y: index % 2 ? 470 : 310, ...elapsedAwayMonsterStats(floor, elapsedDays), phase: random() * 6, location: "hallway", followsIndoors: false, kind: kinds[index % kinds.length] };
}
