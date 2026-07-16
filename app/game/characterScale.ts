export const STANDARD_DOOR_HEIGHT_PX = 312;
export const STANDARD_ADULT_HEIGHT_PX = 256;

export const CHARACTER_SCALE = {
  player: { renderHeightPx: 256, doorRatio: 256 / STANDARD_DOOR_HEIGHT_PX },
  normalAdultNpc: { renderHeightPx: 256, doorRatio: 256 / STANDARD_DOOR_HEIGHT_PX },
  tallNpc: { renderHeightPx: 268, doorRatio: 268 / STANDARD_DOOR_HEIGHT_PX },
  normalMonster: { renderHeightPx: 256, doorRatio: 256 / STANDARD_DOOR_HEIGHT_PX },
  rentPursuer: { renderHeightPx: 268, doorRatio: 268 / STANDARD_DOOR_HEIGHT_PX },
  boss: { renderHeightPx: 342, doorRatio: 342 / STANDARD_DOOR_HEIGHT_PX },
} as const;

export type CharacterScaleRole = keyof typeof CHARACTER_SCALE;

export function getCharacterRenderHeightPx(role: CharacterScaleRole) {
  return CHARACTER_SCALE[role].renderHeightPx;
}

export function getDoorClearancePx(role: CharacterScaleRole) {
  return STANDARD_DOOR_HEIGHT_PX - getCharacterRenderHeightPx(role);
}

export function isStandardAdultDoorRatio(role: CharacterScaleRole) {
  const ratio = CHARACTER_SCALE[role].doorRatio;
  return ratio >= 0.78 && ratio <= 0.82;
}
