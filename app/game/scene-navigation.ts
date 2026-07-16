import type { Location } from "./model";

export type SpawnId = "from_hallway" | "from_room" | "from_elevator" | "default";
export type SceneSpawn = { id: SpawnId; x: number; facing: -1 | 1; safeRadius: number };
export type GroundHit = { grounded: boolean; x: number; y: number; normal: { x: number; y: number }; collider: string; distance: number };
export type CollisionRect = { id: string; x1: number; x2: number; y1: number; y2: number };

export const SCENE_SPAWNS: Record<Location, readonly SceneSpawn[]> = {
  hallway: [
    { id: "from_room", x: .12, facing: 1, safeRadius: .035 },
    { id: "from_elevator", x: .92, facing: -1, safeRadius: .035 },
    { id: "default", x: .1, facing: 1, safeRadius: .04 },
  ],
  room: [
    { id: "from_hallway", x: .18, facing: 1, safeRadius: .045 },
    { id: "default", x: .5, facing: 1, safeRadius: .05 },
  ],
  elevator: [
    { id: "from_hallway", x: .25, facing: 1, safeRadius: .06 },
    { id: "default", x: .5, facing: 1, safeRadius: .06 },
  ],
};

const ROOM_GROUND: readonly [number, number][] = [[0, .89], [.18, .86], [.5, .845], [.82, .86], [1, .89]];
const HALL_GROUND: readonly [number, number][] = [[0, .82], [.5, .81], [1, .82]];
const ELEVATOR_GROUND: readonly [number, number][] = [[0, .84], [1, .84]];

const sampleLine = (points: readonly [number, number][], x: number) => {
  const normalized = Math.max(0, Math.min(1, x));
  for (let index = 1; index < points.length; index++) {
    if (normalized <= points[index][0]) {
      const [ax, ay] = points[index - 1], [bx, by] = points[index];
      const t = (normalized - ax) / Math.max(.0001, bx - ax);
      return ay + (by - ay) * t;
    }
  }
  return points.at(-1)![1];
};

export function probeGround(location: Location, worldX: number, worldWidth: number, viewportHeight: number, fromY = 0): GroundHit {
  const line = location === "room" ? ROOM_GROUND : location === "hallway" ? HALL_GROUND : ELEVATOR_GROUND;
  const y = sampleLine(line, worldX / worldWidth) * viewportHeight;
  return { grounded: true, x: worldX, y: Math.round(y), normal: { x: 0, y: -1 }, collider: `${location}.walkable_ground`, distance: Math.max(0, y - fromY) };
}

export function resolveSpawn(location: Location, spawnId: SpawnId, worldWidth: number, viewportHeight: number) {
  const spawn = SCENE_SPAWNS[location].find(item => item.id === spawnId) ?? SCENE_SPAWNS[location].find(item => item.id === "default");
  if (!spawn) throw new Error(`場景 ${location} 缺少入口 ${spawnId} 與 default`);
  const x = Math.round(spawn.x * worldWidth);
  return { spawn, ground: probeGround(location, x, worldWidth, viewportHeight) };
}

export const ROOM_COLLIDERS: readonly CollisionRect[] = [
  // 家具位於後景；碰撞不得封住前景地板，也不得堵住房門出口。
  { id: "bed", x1: .22, x2: .51, y1: .66, y2: .79 },
  { id: "desk_and_chair", x1: .51, x2: .69, y1: .61, y2: .78 },
  { id: "television_cabinet", x1: .66, x2: .78, y1: .59, y2: .78 },
  { id: "wardrobe", x1: .75, x2: .91, y1: .33, y2: .79 },
];

export function isWalkable(location: Location, x: number, y: number, worldWidth: number, viewportHeight: number, radius = 24) {
  const ground = probeGround(location, x, worldWidth, viewportHeight);
  if (Math.abs(y - ground.y) > viewportHeight * .12) return false;
  if (location !== "room") return true;
  return !ROOM_COLLIDERS.some(rect => x + radius > rect.x1 * worldWidth && x - radius < rect.x2 * worldWidth && y > rect.y1 * viewportHeight && y - 8 < rect.y2 * viewportHeight);
}

export function validateSceneNavigation() {
  for (const [scene, spawns] of Object.entries(SCENE_SPAWNS)) {
    const ids = new Set<string>();
    for (const spawn of spawns) {
      if (ids.has(spawn.id)) throw new Error(`${scene} 入口 ID 重複：${spawn.id}`);
      ids.add(spawn.id);
      const width = scene === "hallway" ? 1800 : scene === "elevator" ? 420 : 1000;
      const resolved = resolveSpawn(scene as Location, spawn.id, width, 900);
      if (!resolved.ground.grounded) throw new Error(`${scene}.${spawn.id} 下方沒有地面`);
      if (!isWalkable(scene as Location, resolved.ground.x, resolved.ground.y, width, 900)) throw new Error(`${scene}.${spawn.id} 與碰撞區重疊`);
    }
  }
  const roomSpawn = resolveSpawn("room", "from_hallway", 1000, 900).ground;
  for (let x = roomSpawn.x; x >= 80; x -= 10) {
    if (!isWalkable("room", x, probeGround("room", x, 1000, 900).y, 1000, 900)) throw new Error(`房門出口路徑在 x=${x} 被阻擋`);
  }
  for (let x = roomSpawn.x; x <= 720; x += 10) {
    if (!isWalkable("room", x, probeGround("room", x, 1000, 900).y, 1000, 900)) throw new Error(`置物櫃路徑在 x=${x} 被阻擋`);
  }
  return true;
}
