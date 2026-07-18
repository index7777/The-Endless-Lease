import type { DebtEntry, GameRuntime } from "./model";

export type DayAdvanceReason = "natural" | "sleep" | "scripted";

export type SleepBlockReason =
  | "not_in_player_room"
  | "in_combat"
  | "player_incapacitated"
  | "cutscene_active"
  | "scene_transition"
  | "day_transition_active"
  | "rent_overdue";

export type SleepCheckInput = {
  isInPlayerRoom: boolean;
  isInCombat: boolean;
  isPlayerIncapacitated: boolean;
  isCutsceneActive: boolean;
  isSceneTransitioning: boolean;
  isDayTransitioning: boolean;
  outstandingRentDebt: number;
};

export type SleepCheckResult = { allowed: true } | { allowed: false; reason: SleepBlockReason };

export type RentSettlementResult = {
  rentAmount: number;
  paymentSucceeded: boolean;
  amountPaid: number;
  debtAdded: number;
  totalOutstandingDebt: number;
};

export type DayAdvanceResult = {
  reason: DayAdvanceReason;
  day: number;
  settlement: RentSettlementResult;
  healthRestored: boolean;
};

export type RentPaymentFailureReason =
  | "no_outstanding_debt"
  | "insufficient_funds"
  | "payment_in_progress"
  | "persistence_failed";

export type RentPaymentResult =
  | { success: true; amountPaid: number; remainingMoney: number }
  | { success: false; failureReason: RentPaymentFailureReason };

export type TransactionLock = { current: boolean };

export const debtTotal = (entries: readonly DebtEntry[]) => entries.reduce((sum, entry) => sum + Math.max(0, entry.remainingBalance), 0);

export const hasOutstandingRent = (runtime: Pick<GameRuntime, "debtLedger">) => debtTotal(runtime.debtLedger) > 0;

export function checkCanSleep(input: SleepCheckInput): SleepCheckResult {
  if (!input.isInPlayerRoom) return { allowed: false, reason: "not_in_player_room" };
  if (input.isInCombat) return { allowed: false, reason: "in_combat" };
  if (input.isPlayerIncapacitated) return { allowed: false, reason: "player_incapacitated" };
  if (input.isCutsceneActive) return { allowed: false, reason: "cutscene_active" };
  if (input.isSceneTransitioning) return { allowed: false, reason: "scene_transition" };
  if (input.isDayTransitioning) return { allowed: false, reason: "day_transition_active" };
  if (input.outstandingRentDebt > 0) return { allowed: false, reason: "rent_overdue" };
  return { allowed: true };
}

export function settleDailyRent(runtime: GameRuntime, createdAt = Date.now()): RentSettlementResult {
  const rentAmount = Math.max(0, Math.floor(runtime.rentDue));
  let amountPaid = 0;
  let debtAdded = 0;

  if (runtime.rent >= rentAmount) {
    runtime.rent -= rentAmount;
    amountPaid = rentAmount;
  } else {
    debtAdded = rentAmount;
    runtime.debtLedger.push({
      dayId: runtime.day,
      originalRent: rentAmount,
      remainingBalance: rentAmount,
      interestApplied: false,
      createdAt,
    });
    runtime.overdueDays += 1;
  }

  const totalOutstandingDebt = debtTotal(runtime.debtLedger);
  runtime.arrears = totalOutstandingDebt;
  runtime.debtMode = totalOutstandingDebt > 0;
  runtime.rentProtectionLost = totalOutstandingDebt > 0;
  if (totalOutstandingDebt === 0) runtime.homeBreachTriggered = false;

  return {
    rentAmount,
    paymentSucceeded: debtAdded === 0,
    amountPaid,
    debtAdded,
    totalOutstandingDebt,
  };
}

export function advanceToNextDay(
  runtime: GameRuntime,
  options: { reason: DayAdvanceReason; restoreFullHealth: boolean; maxHealth: number; nextDailyRent: number; createdAt?: number },
): DayAdvanceResult {
  runtime.day += 1;
  runtime.time = 720;
  const settlement = settleDailyRent(runtime, options.createdAt);
  const healthRestored = options.restoreFullHealth;
  if (healthRestored) runtime.player.hp = options.maxHealth;
  runtime.player.stamina = Math.max(runtime.player.stamina, 0);
  runtime.rentDue = Math.max(0, Math.floor(options.nextDailyRent));
  runtime.landlordTask = false;
  runtime.phaseIndex = 0;
  runtime.phaseFlash = .35;
  runtime.settlementTriggered = true;
  return { reason: options.reason, day: runtime.day, settlement, healthRestored };
}

export function payAllOutstandingRentToHongYi(
  runtime: GameRuntime,
  lock: TransactionLock,
  persist: () => void,
): RentPaymentResult {
  if (lock.current) return { success: false, failureReason: "payment_in_progress" };

  const debt = debtTotal(runtime.debtLedger);
  if (debt <= 0) return { success: false, failureReason: "no_outstanding_debt" };
  if (runtime.rent < debt) return { success: false, failureReason: "insufficient_funds" };

  lock.current = true;
  const snapshot = {
    rent: runtime.rent,
    debtLedger: runtime.debtLedger.map(entry => ({ ...entry })),
    overdueDays: runtime.overdueDays,
    arrears: runtime.arrears,
    debtMode: runtime.debtMode,
    rentProtectionLost: runtime.rentProtectionLost,
    homeBreachTriggered: runtime.homeBreachTriggered,
  };

  try {
    runtime.rent -= debt;
    runtime.debtLedger = [];
    runtime.overdueDays = 0;
    runtime.arrears = 0;
    runtime.debtMode = false;
    runtime.rentProtectionLost = false;
    runtime.homeBreachTriggered = false;
    persist();
    return { success: true, amountPaid: debt, remainingMoney: runtime.rent };
  } catch {
    runtime.rent = snapshot.rent;
    runtime.debtLedger = snapshot.debtLedger;
    runtime.overdueDays = snapshot.overdueDays;
    runtime.arrears = snapshot.arrears;
    runtime.debtMode = snapshot.debtMode;
    runtime.rentProtectionLost = snapshot.rentProtectionLost;
    runtime.homeBreachTriggered = snapshot.homeBreachTriggered;
    return { success: false, failureReason: "persistence_failed" };
  } finally {
    lock.current = false;
  }
}
