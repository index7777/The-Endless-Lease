export const ATTRIBUTE_NAMES = ["體魄", "反應", "意志", "感知", "交涉", "異常親和"] as const;

export const IDENTITIES = ["清潔工", "醫師", "逃犯", "房仲", "靈媒", "前住戶"] as const;
export const TALENTS = ["租緩", "窺層", "偽居", "契語", "蝕耐", "存契"] as const;
export const DEFECTS = ["貪息", "寡眠", "幻聽", "直白", "輕厄", "無家"] as const;

export type DestinyOutcome = {
  identity: typeof IDENTITIES[number];
  talent: typeof TALENTS[number];
  defect: typeof DEFECTS[number];
  identityNumber: number;
  talentNumber: number;
  defectNumber: number;
  identitySum: number;
  talentSum: number;
  defectProduct: number;
  ruleId: "dice.v2.independent";
};

const wrapD6 = (value: number) => (value - 1) % 6 + 1;

export function evaluateDestiny(values: readonly number[]): DestinyOutcome {
  if (values.length !== 6 || values.some(value => !Number.isInteger(value) || value < 1 || value > 6)) {
    throw new Error("命運裁定必須包含六個 1–6 的整數骰面");
  }
  const identitySum = values[0] + values[2] + values[4];
  const talentSum = values[1] + values[3] + values[5];
  const defectProduct = values.reduce((product, value) => product * value, 1);
  const identityNumber = wrapD6(identitySum);
  const talentNumber = wrapD6(talentSum);
  const defectNumber = wrapD6(defectProduct);
  return {
    identity: IDENTITIES[identityNumber - 1],
    talent: TALENTS[talentNumber - 1],
    defect: DEFECTS[defectNumber - 1],
    identityNumber,
    talentNumber,
    defectNumber,
    identitySum,
    talentSum,
    defectProduct,
    ruleId: "dice.v2.independent",
  };
}
