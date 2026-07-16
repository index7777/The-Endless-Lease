export type Location = "hallway" | "room" | "elevator";

export type Enemy = {
  x: number;
  y: number;
  hp: number;
  phase: number;
  alerted?: boolean;
  elite?: boolean;
  threat?: number;
  location: Location;
  roomSlot?: number;
  followsIndoors?: boolean;
  kind?: "wall" | "light" | "receipt" | "pursuer" | "boss_b1" | "boss_b2";
  maxHp?: number;
  attackTimer?: number;
  attackCooldown?: number;
  attackLanded?: boolean;
  combatSeen?: boolean;
};

export type DebtEntry = {
  dayId: number;
  originalRent: number;
  remainingBalance: number;
  interestApplied: boolean;
  createdAt: number;
};

export type Pickup = {
  x: number;
  y: number;
  type: "租券" | "藥品" | "鑰匙" | "裝備" | "特殊權限卡";
  taken: boolean;
};

export type StorageKind = "rent" | "medkits" | "keys";

export type StorageStack = {
  id: number;
  slot: number;
  kind: StorageKind;
  quantity: number;
};

export type FloorState = {
  enemies: Enemy[];
  pickups: Pickup[];
  visitedRooms: number[];
  lastSpawnDay: number;
};

export type Destiny = {
  attributes: number[];
  gender: "male" | "female";
  identity: string;
  talent: string;
  defect: string;
  floor: number;
  roomSlot: number;
};
