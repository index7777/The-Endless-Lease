import type { Enemy, Pickup } from "./model";

export type EnemyKind = NonNullable<Enemy["kind"]>;

export const RENT_BALANCE = {
  base: 10,
  floorLinear: 1.8,
  floorQuadratic: .11,
  attentionMultiplierPerLevel: .06,
  negotiationReductionPerPoint: .025,
  negotiationReductionCap: .2,
} as const;

// 1–9F are the current formal residential floors. Values are pre-rounding base rent,
// so attention and negotiation still apply before the final ceil exactly as before.
export const RESIDENTIAL_FLOOR_BASE_RENT: Readonly<Record<number, number>> = {
  1: 11.91,
  2: 14.04,
  3: 16.39,
  4: 18.96,
  5: 21.75,
  6: 24.76,
  7: 27.99,
  8: 31.44,
  9: 35.11,
};

export function calculateDailyRent(floor: number, attention: number, negotiation: number) {
  const rawFloorRent = RESIDENTIAL_FLOOR_BASE_RENT[floor]
    ?? RENT_BALANCE.base + RENT_BALANCE.floorLinear * floor + RENT_BALANCE.floorQuadratic * floor * floor;
  const attentionMultiplier = 1 + attention * RENT_BALANCE.attentionMultiplierPerLevel;
  const negotiationMultiplier = 1 - Math.min(RENT_BALANCE.negotiationReductionCap, negotiation * RENT_BALANCE.negotiationReductionPerPoint);
  return Math.ceil(rawFloorRent * attentionMultiplier * negotiationMultiplier);
}

export const FLOOR_GENERATION_BALANCE = {
  monsterCapBase: 6,
  monsterCapPerFloors: 10,
  monsterCapMaximum: 10,
  initialMonsterMinimum: 2,
  initialMonsterRandomRange: 3,
  initialMonsterFloorStep: 12,
  pickupMinimum: 2,
  pickupRandomRange: 3,
  monsterSpawnMinX: 330,
  monsterSpawnMaxX: 1500,
  monsterSpawnSeparation: 175,
  pickupSpawnMinX: 300,
  pickupSpawnMaxX: 1480,
  pickupSpawnSeparation: 140,
  elapsedDayMonsterInterval: 2,
} as const;

export function floorMonsterCap(floor: number) {
  return Math.min(FLOOR_GENERATION_BALANCE.monsterCapMaximum, FLOOR_GENERATION_BALANCE.monsterCapBase + Math.floor(floor / FLOOR_GENERATION_BALANCE.monsterCapPerFloors));
}

export function initialFloorMonsterCount(floor: number, random: () => number = Math.random) {
  const requested = FLOOR_GENERATION_BALANCE.initialMonsterMinimum
    + Math.floor(random() * FLOOR_GENERATION_BALANCE.initialMonsterRandomRange)
    + Math.floor(floor / FLOOR_GENERATION_BALANCE.initialMonsterFloorStep);
  return Math.min(floorMonsterCap(floor) - 1, requested);
}

export function floorPickupCount(random: () => number = Math.random) {
  return FLOOR_GENERATION_BALANCE.pickupMinimum + Math.floor(random() * FLOOR_GENERATION_BALANCE.pickupRandomRange);
}

export const PICKUP_GENERATION_BALANCE = {
  equipmentBaseChance: .06,
  equipmentChancePerFloor: .008,
  equipmentChanceCap: .28,
  medicineThreshold: .38,
  keyThreshold: .57,
} as const;

export function pickupTypeForRoll(floor: number, roll: number): Pickup["type"] {
  const equipmentChance = Math.min(PICKUP_GENERATION_BALANCE.equipmentChanceCap, PICKUP_GENERATION_BALANCE.equipmentBaseChance + floor * PICKUP_GENERATION_BALANCE.equipmentChancePerFloor);
  return roll < equipmentChance ? "裝備" : roll < PICKUP_GENERATION_BALANCE.medicineThreshold ? "藥品" : roll < PICKUP_GENERATION_BALANCE.keyThreshold ? "鑰匙" : "租券";
}

export const MONSTER_GENERATION_BALANCE = {
  initialHpBase: 42,
  initialHpPerFloor: 4,
  initialHpRandomRange: 18,
  initialMaxHpPadding: 18,
  elapsedHpBase: 44,
  elapsedMaxHpBase: 62,
  elapsedHpPerFloor: 4,
  elapsedHpPerDay: 2,
  elapsedMaxHpPerDay: 2,
  elapsedAwayHpPerDay: 3,
} as const;

export function initialMonsterStats(floor: number, random: () => number = Math.random) {
  return {
    hp: MONSTER_GENERATION_BALANCE.initialHpBase + floor * MONSTER_GENERATION_BALANCE.initialHpPerFloor + Math.floor(random() * MONSTER_GENERATION_BALANCE.initialHpRandomRange),
    maxHp: MONSTER_GENERATION_BALANCE.initialHpBase + floor * MONSTER_GENERATION_BALANCE.initialHpPerFloor + MONSTER_GENERATION_BALANCE.initialMaxHpPadding,
  };
}

export function elapsedDayMonsterStats(floor: number, day: number) {
  return {
    hp: MONSTER_GENERATION_BALANCE.elapsedHpBase + floor * MONSTER_GENERATION_BALANCE.elapsedHpPerFloor + day * MONSTER_GENERATION_BALANCE.elapsedHpPerDay,
    maxHp: MONSTER_GENERATION_BALANCE.elapsedMaxHpBase + floor * MONSTER_GENERATION_BALANCE.elapsedHpPerFloor + day * MONSTER_GENERATION_BALANCE.elapsedMaxHpPerDay,
  };
}

export function elapsedAwayMonsterStats(floor: number, elapsedDays: number) {
  return {
    hp: MONSTER_GENERATION_BALANCE.elapsedHpBase + floor * MONSTER_GENERATION_BALANCE.elapsedHpPerFloor + elapsedDays * MONSTER_GENERATION_BALANCE.elapsedAwayHpPerDay,
    maxHp: MONSTER_GENERATION_BALANCE.elapsedMaxHpBase + floor * MONSTER_GENERATION_BALANCE.elapsedHpPerFloor + elapsedDays * MONSTER_GENERATION_BALANCE.elapsedAwayHpPerDay,
  };
}

export const ENEMY_COMBAT_BALANCE: Record<EnemyKind, { damage: number; speed: number; chaseDistance: number; contactDistance: number }> = {
  wall: { damage: 14, speed: 90, chaseDistance: 330, contactDistance: 58 },
  light: { damage: 10, speed: 105, chaseDistance: 450, contactDistance: 58 },
  receipt: { damage: 11, speed: 145, chaseDistance: 550, contactDistance: 58 },
  pursuer: { damage: 10, speed: 90, chaseDistance: 330, contactDistance: 58 },
  boss_b1: { damage: 10, speed: 52, chaseDistance: 620, contactDistance: 78 },
  boss_b2: { damage: 14, speed: 52, chaseDistance: 620, contactDistance: 78 },
};

export function enemyCombatBalance(kind: Enemy["kind"]) {
  return ENEMY_COMBAT_BALANCE[kind ?? "wall"];
}

export const BOSS_BALANCE = {
  boss_b1: { maxHp: 420, rentReward: 18, scoreReward: 120 },
  boss_b2: { maxHp: 680, rentReward: 26, scoreReward: 180 },
} as const;

export const PURSUER_BALANCE = {
  hpBase: 75,
  hpPerThreat: 38,
  hpPerIndex: 16,
  damagePerThreat: 2,
  countBase: 2,
} as const;

export function pursuerHealth(threat: number, index: number) {
  return PURSUER_BALANCE.hpBase + threat * PURSUER_BALANCE.hpPerThreat + index * PURSUER_BALANCE.hpPerIndex;
}

export function enemyDamage(enemy: Pick<Enemy, "kind" | "elite" | "threat">) {
  return enemyCombatBalance(enemy.kind).damage + (enemy.elite ? (enemy.threat ?? 1) * PURSUER_BALANCE.damagePerThreat : 0);
}

export const DROP_BALANCE = {
  ordinaryRent: 7,
  pursuerRentBase: 6,
  pursuerRentPerThreat: 2,
  ordinaryScore: 21,
  pursuerScoreBase: 28,
  pursuerScorePerThreat: 7,
} as const;

export function escapeYieldMultiplier(currentFloor: number, boundFloor: number, kind: "base" | "event" | "monster") {
  const gap = boundFloor - currentFloor;
  if (gap <= 0) return 1;
  if (gap <= 2) return kind === "event" ? .85 : kind === "base" ? .8 : 1;
  if (gap <= 4) return kind === "event" ? .75 : kind === "monster" ? .8 : .65;
  return kind === "event" ? .6 : kind === "monster" ? .7 : .5;
}

export function monsterRentDrop(enemy: Pick<Enemy, "elite" | "threat">, currentFloor: number, boundFloor: number) {
  const raw = enemy.elite ? DROP_BALANCE.pursuerRentBase + (enemy.threat ?? 1) * DROP_BALANCE.pursuerRentPerThreat : DROP_BALANCE.ordinaryRent;
  return Math.max(1, Math.floor(raw * escapeYieldMultiplier(currentFloor, boundFloor, "monster")));
}

export function monsterScoreReward(enemy: Pick<Enemy, "elite" | "threat">) {
  return enemy.elite ? DROP_BALANCE.pursuerScoreBase + (enemy.threat ?? 1) * DROP_BALANCE.pursuerScorePerThreat : DROP_BALANCE.ordinaryScore;
}

export const ITEM_BALANCE = {
  rentPickupBase: 22,
  lightMisfortuneRentMultiplier: .9,
  medicineHeal: 38,
  firstAidMedicineHeal: 55,
  medicineCooldownSeconds: 3,
  keyScore: 12,
  weaponScore: 30,
  weaponMaxLevel: 3,
  playerAttackBasePerSecond: 118,
  playerAttackPerWeaponLevelPerSecond: 28,
  weaponGrowthMode: "flat_per_level",
  attackAnimationFrames: 16,
  attackAnimationFps: 24,
  attackHitWindowRemainingMin: .2,
  attackHitWindowRemainingMax: .37,
  attackRange: 132,
  attackStaminaBaseCost: 16,
  attackStaminaMinimumCost: 8,
  attackStaminaReductionPerAgility: 1,
} as const;

export const ITEM_DEFINITIONS: Readonly<Record<Pickup["type"], { category: string; effect: string }>> = {
  租券: { category: "currency", effect: "增加租券；基礎取得量套用樓層與缺陷修正" },
  藥品: { category: "consumable", effect: "增加一份過期藥品；使用時依急救常識回復生命" },
  鑰匙: { category: "key", effect: "增加一把老舊房門鑰匙並增加戰力，可供事件消耗" },
  裝備: { category: "weapon_upgrade", effect: "改造鋼管提升一級；採每級固定傷害加值，最高三級" },
  特殊權限卡: { category: "progression", effect: "推進 10F 權限與 Demo 結案流程" },
};

export function medicineHealing(hasFirstAidKnowledge: boolean) {
  return hasFirstAidKnowledge ? ITEM_BALANCE.firstAidMedicineHeal : ITEM_BALANCE.medicineHeal;
}

export function playerAttackDamagePerSecond(weaponLevel: number) {
  return ITEM_BALANCE.playerAttackBasePerSecond + weaponLevel * ITEM_BALANCE.playerAttackPerWeaponLevelPerSecond;
}

export function playerAttackDurationSeconds() {
  return ITEM_BALANCE.attackAnimationFrames / ITEM_BALANCE.attackAnimationFps;
}

export function playerAttackStaminaCost(agility: number) {
  return Math.max(ITEM_BALANCE.attackStaminaMinimumCost, ITEM_BALANCE.attackStaminaBaseCost - agility * ITEM_BALANCE.attackStaminaReductionPerAgility);
}

export const ENEMY_ATTACK_BALANCE = {
  normal: { duration: .48, cooldown: 1.05, landingAtRemaining: .22, hitRange: 67 },
  elite: { duration: .48, cooldown: 1.18, landingAtRemaining: .22, hitRange: 67 },
  boss: { duration: .68, cooldown: 1.5, landingAtRemaining: .34, hitRange: 92 },
} as const;

export function enemyAttackBalance(enemy: Pick<Enemy, "kind" | "elite">) {
  return enemy.kind === "boss_b1" || enemy.kind === "boss_b2" ? ENEMY_ATTACK_BALANCE.boss : enemy.elite ? ENEMY_ATTACK_BALANCE.elite : ENEMY_ATTACK_BALANCE.normal;
}
