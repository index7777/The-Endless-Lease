import type { EventAssignment } from "./model";
import type { RoomCollisionProfile } from "./scene-navigation";

export type RandomEventId = "seepage_wall" | "sealed_wall" | "resident_clinic";

export type RandomEventDefinition = {
  id: RandomEventId;
  title: string;
  description: string;
  choices: readonly [string, string, string];
  sceneKey: "eventSeepageWall" | "eventSealedWall" | "clinic";
  sceneAsset: string;
  promptDocument: string;
  interactionRange: readonly [number, number];
  interactionLabelX: number;
  collisionProfile: RoomCollisionProfile;
  entrance: { side: "left"; handleSide: "right" };
};

export const RANDOM_EVENT_REGISTRY: readonly RandomEventDefinition[] = [
  {
    id: "seepage_wall",
    title: "滲水牆面",
    description: "牆壁滲出溫熱水跡。那不是漏水，而是牆體內部滲出的透明軟質液體；地面散落數張未繳的舊租單。",
    choices: ["撿起舊租單", "擦拭牆面滲液", "直接離開房間"],
    sceneKey: "eventSeepageWall",
    sceneAsset: "/scene-event-seepage-wall-v1.png",
    promptDocument: "docs/scenes/random-event-generation-prompts-v1.md#seepage_wall",
    interactionRange: [760, 1110],
    interactionLabelX: 930,
    collisionProfile: "memory_echo",
    entrance: { side: "left", handleSide: "right" },
  },
  {
    id: "sealed_wall",
    title: "封鎖牆面",
    description: "整面牆被潮濕磚層與鏽蝕鋼條反覆封死，舊門框和租單纖維已長進水泥裡；鋼條後方仍傳來規律敲擊。",
    choices: ["檢查封鎖鋼條", "用房門鑰匙撬開夾層", "不碰觸並離開"],
    sceneKey: "eventSealedWall",
    sceneAsset: "/scene-event-sealed-wall-v1.png",
    promptDocument: "docs/scenes/random-event-generation-prompts-v1.md#sealed_wall",
    interactionRange: [760, 1110],
    interactionLabelX: 930,
    collisionProfile: "memory_echo",
    entrance: { side: "left", handleSide: "right" },
  },
  {
    id: "resident_clinic",
    title: "住戶診療台",
    description: "診療台的皮面已龜裂，束帶卻仍帶著餘溫。器械盤下壓著一張住戶檢查紀錄，最後一欄只寫著：人形資格待複核。",
    choices: ["翻閱診療紀錄", "檢查器械盤", "不碰觸並離開"],
    sceneKey: "clinic",
    sceneAsset: "/scene-clinic-v3.png",
    promptDocument: "docs/scenes/random-event-generation-prompts-v1.md#resident_clinic",
    interactionRange: [820, 1080],
    interactionLabelX: 950,
    collisionProfile: "clinic",
    entrance: { side: "left", handleSide: "right" },
  },
] as const;

export function getRandomEvent(eventId: string | null | undefined) {
  return RANDOM_EVENT_REGISTRY.find(event => event.id === eventId);
}

export function createRandomEventAssignments(leaseFloor: number, leaseSlot: number, random = Math.random): EventAssignment[] {
  const highestReachableFloor = Math.min(9, leaseFloor + 3);
  const availableRooms = Array.from({ length: highestReachableFloor }, (_, floorIndex) => floorIndex + 1)
    .flatMap(floor => Array.from({ length: 9 }, (_, slotIndex) => ({ floor, slot: slotIndex + 1 })))
    .filter(room => room.floor !== leaseFloor || room.slot !== leaseSlot);
  for (let index = availableRooms.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [availableRooms[index], availableRooms[swapIndex]] = [availableRooms[swapIndex], availableRooms[index]];
  }
  return RANDOM_EVENT_REGISTRY.map((event, index) => ({ eventId: event.id, ...availableRooms[index] }));
}

export function findAssignedRandomEvent(assignments: readonly EventAssignment[], floor: number, slot: number) {
  const assignment = assignments.find(item => item.floor === floor && item.slot === slot);
  return getRandomEvent(assignment?.eventId);
}

export function distanceToEventInteraction(event: RandomEventDefinition, x: number) {
  if (x < event.interactionRange[0]) return event.interactionRange[0] - x;
  if (x > event.interactionRange[1]) return x - event.interactionRange[1];
  return 0;
}
