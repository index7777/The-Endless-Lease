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
  hitTimer?: number;
  deathTimer?: number;
  deathDuration?: number;
  deathFacing?: -1 | 1;
  rewardGranted?: boolean;
  aiState?: "patrol" | "chase";
  patrolAnchorX?: number;
  patrolAnchorY?: number;
  patrolTargetX?: number;
  patrolTargetY?: number;
  patrolWait?: number;
  stuckSeconds?: number;
  moving?: boolean;
  facing?: -1 | 1;
  emerging?: boolean;
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
  amount?: number;
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

export type EventAssignment = {
  eventId: string;
  floor: number;
  slot: number;
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

export type GameRuntime = {
  player: { x: number; y: number; hp: number; stamina: number; facing: number; attack: number; invuln: number };
  enemies: Enemy[];
  pickups: Pickup[];
  rent: number;
  time: number;
  score: number;
  day: number;
  rentDue: number;
  settlementTriggered: boolean;
  landlordTask: boolean;
  overdueDays: number;
  taskKills: number;
  debtMode: boolean;
  arrears: number;
  rentProtectionLost: boolean;
  homeBreachTriggered: boolean;
  breachTick: number;
  floor: number;
  attention: number;
  visitedRooms: number[];
  resolvedEventIds?: string[];
  eventAssignments?: EventAssignment[];
  floorStates: Record<number, FloorState>;
  weaponLevel: number;
  medkits: number;
  keysOwned: number;
  skillCooldown: number;
  camera: number;
  dead: boolean;
  debtLedger: DebtEntry[];
  mortgageLayers: number;
  defeatedBosses: string[];
  activeBoss: null | "boss_b1" | "boss_b2";
  phaseIndex: number;
  phaseFlash: number;
};
