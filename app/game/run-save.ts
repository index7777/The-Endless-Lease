import type { DemoEndingState } from "./demo-ending";
import type { Destiny, GameRuntime, Location, StorageStack } from "./model";

export const RUN_SAVE_KEY = "endless-lease.run-save.v1";
export const RUN_SAVE_VERSION = 1 as const;

export type RunSaveV1 = {
  schemaVersion: typeof RUN_SAVE_VERSION;
  savedAt: number;
  residentName: string;
  destiny: Destiny;
  location: Location;
  activeRoom: number | null;
  demoEndingState: DemoEndingState;
  storage: StorageStack[];
  storageCapacity: number;
  mortgageMarks: string[];
  residentLog: string[];
  game: GameRuntime;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isInteger = (value: unknown): value is number => Number.isInteger(value);
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");
const LOCATIONS: Location[] = ["hallway", "room", "elevator"];
const ENDING_STATES: DemoEndingState[] = ["B2_ALIVE", "B2_DEFEATED", "KEYCARD_DROPPED", "KEYCARD_COLLECTED", "CLEARANCE_REPORT_VIEWED", "FLOOR10_BUTTON_DISCOVERED", "RETURN_TO_OFFICE", "KEYCARD_DELIVERED", "POST_B2_FREE_ROAM", "FLOOR10_NOTICE_DISCOVERED", "DEMO_ENDING_STARTED", "DEMO_COMPLETED"];

const isDestiny = (value: unknown): value is Destiny => isRecord(value)
  && Array.isArray(value.attributes)
  && value.attributes.length === 6
  && value.attributes.every(item => isInteger(item) && item >= 0 && item <= 6)
  && (value.gender === "male" || value.gender === "female")
  && typeof value.identity === "string"
  && typeof value.talent === "string"
  && typeof value.defect === "string"
  && isInteger(value.floor)
  && isInteger(value.roomSlot)
  && value.roomSlot >= 1
  && value.roomSlot <= 9;

const isGameRuntime = (value: unknown): value is GameRuntime => {
  if (!isRecord(value) || !isRecord(value.player) || !isRecord(value.floorStates)) return false;
  const player = value.player;
  const numericPlayerFields = [player.x, player.y, player.hp, player.stamina, player.facing, player.attack, player.invuln];
  const numericFields = [value.rent, value.time, value.score, value.day, value.rentDue, value.arrears, value.breachTick, value.floor, value.attention, value.weaponLevel, value.medkits, value.keysOwned, value.skillCooldown, value.camera, value.mortgageLayers, value.phaseIndex, value.phaseFlash];
  return numericPlayerFields.every(isFiniteNumber)
    && numericFields.every(isFiniteNumber)
    && Array.isArray(value.enemies)
    && Array.isArray(value.pickups)
    && Array.isArray(value.visitedRooms)
    && Array.isArray(value.debtLedger)
    && isStringArray(value.defeatedBosses)
    && [value.settlementTriggered, value.landlordTask, value.debtMode, value.rentProtectionLost, value.homeBreachTriggered, value.dead].every(item => typeof item === "boolean")
    && (value.activeBoss === null || value.activeBoss === "boss_b1" || value.activeBoss === "boss_b2");
};

const isStorage = (value: unknown): value is StorageStack[] => Array.isArray(value) && value.every(stack => isRecord(stack)
  && isInteger(stack.id)
  && isInteger(stack.slot)
  && (stack.kind === "rent" || stack.kind === "medkits" || stack.kind === "keys")
  && isInteger(stack.quantity)
  && stack.quantity > 0);

export const parseRunSave = (serialized: string | null): RunSaveV1 | null => {
  if (!serialized) return null;
  try {
    const value: unknown = JSON.parse(serialized);
    if (!isRecord(value)
      || value.schemaVersion !== RUN_SAVE_VERSION
      || !isFiniteNumber(value.savedAt)
      || typeof value.residentName !== "string"
      || !isDestiny(value.destiny)
      || !LOCATIONS.includes(value.location as Location)
      || !(value.activeRoom === null || isInteger(value.activeRoom))
      || !ENDING_STATES.includes(value.demoEndingState as DemoEndingState)
      || !isStorage(value.storage)
      || !isInteger(value.storageCapacity)
      || value.storageCapacity < 5
      || value.storageCapacity > 15
      || !isStringArray(value.mortgageMarks)
      || !isStringArray(value.residentLog)
      || !isGameRuntime(value.game)) return null;
    const save = value as RunSaveV1;
    save.game.player.attack = 0;
    save.game.player.invuln = 0;
    save.game.settlementTriggered = false;
    save.game.dead = false;
    save.game.phaseFlash = 0;
    return save;
  } catch {
    return null;
  }
};

export const serializeRunSave = (save: Omit<RunSaveV1, "schemaVersion" | "savedAt">, savedAt = Date.now()) => JSON.stringify({
  ...save,
  schemaVersion: RUN_SAVE_VERSION,
  savedAt,
});
