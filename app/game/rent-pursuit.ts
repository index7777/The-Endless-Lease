export type RentPursuitWave = {
  debtCount: number;
  count: number;
  threat: number;
};

export function getRentPursuitWave(debtCount: number): RentPursuitWave {
  const normalizedDebtCount = Math.max(1, Math.floor(debtCount));
  return {
    debtCount: normalizedDebtCount,
    count: 2 ** (normalizedDebtCount - 1),
    threat: normalizedDebtCount,
  };
}
