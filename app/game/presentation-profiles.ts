import type { Location } from "./model";

export const GAME_DAY_SECONDS = 720;
export type TimePeriod = "daylight" | "evening" | "curfew_night" | "uncanny_dawn";
export const TIME_PERIOD_ORDER: readonly TimePeriod[] = ["daylight", "evening", "curfew_night", "uncanny_dawn"];
export const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
  daylight: "白晝",
  evening: "黃昏",
  curfew_night: "宵禁深夜",
  uncanny_dawn: "臨晨詭時",
};
export const TIME_PERIOD_PROFILES: Record<TimePeriod, { exposure: number; cold: number; practicalIntensity: number; outageChance: number }> = {
  daylight: { exposure: 1, cold: .05, practicalIntensity: 1, outageChance: 0 },
  evening: { exposure: .84, cold: -.18, practicalIntensity: .9, outageChance: .08 },
  curfew_night: { exposure: .64, cold: .22, practicalIntensity: .72, outageChance: .22 },
  uncanny_dawn: { exposure: .48, cold: .38, practicalIntensity: .52, outageChance: .38 },
};

export const SCENE_PRESENTATION = {
  hallway: { profile: "hallway_fluorescent", lights: [.22, .51, .82], wetReflection: .34, characterExposure: .96, characterScale: 1 },
  room: { profile: "resident_tungsten_fluorescent", lights: [.55], wetReflection: .12, characterExposure: .9, characterScale: 1.56 },
  elevator: { profile: "elevator_cold_metal", lights: [.5], wetReflection: .27, characterExposure: .92, characterScale: 2.1 },
} satisfies Record<Location, { profile: string; lights: number[]; wetReflection: number; characterExposure: number; characterScale: number }>;

export type SceneLightingContext = Location | "management" | "b1" | "b2" | "clinic";

type CharacterLightingProfile = {
  lights: readonly number[];
  baseExposure: number;
  minExposure: number;
  maxExposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
  localLightBoost: number;
  lightRadius: number;
  shadowOpacity: number;
  shadowBlurPx: number;
  shadowReachPx: number;
  edgeSoftnessPx: number;
};

export type CharacterLightingSample = {
  exposure: number;
  contrast: number;
  colorNeutralization: number;
  saturation: number;
  blackPoint: number;
  temperature: number;
  sepia: number;
  hueRotateDeg: number;
  edgeSoftnessPx: number;
  shadowOpacity: number;
  shadowBlurPx: number;
  shadowOffsetX: number;
};

export type SceneColorGrade = {
  multiply: readonly [number, number, number];
  multiplyOpacity: number;
  softLight: readonly [number, number, number];
  softLightOpacity: number;
};

export const CHARACTER_LIGHTING_PROFILES: Record<SceneLightingContext, CharacterLightingProfile> = {
  hallway: { lights: [.22, .51, .82], baseExposure: .63, minExposure: .48, maxExposure: .75, contrast: 1.06, saturation: .62, temperature: 0, localLightBoost: .1, lightRadius: .18, shadowOpacity: .4, shadowBlurPx: 2.4, shadowReachPx: 72, edgeSoftnessPx: .12 },
  room: { lights: [.55], baseExposure: .75, minExposure: .58, maxExposure: .92, contrast: .98, saturation: .82, temperature: -.18, localLightBoost: .15, lightRadius: .34, shadowOpacity: .36, shadowBlurPx: 2.8, shadowReachPx: 58, edgeSoftnessPx: .14 },

  elevator: { lights: [.5], baseExposure: .64, minExposure: .5, maxExposure: .78, contrast: 1.07, saturation: .58, temperature: .34, localLightBoost: .12, lightRadius: .28, shadowOpacity: .42, shadowBlurPx: 2.1, shadowReachPx: 48, edgeSoftnessPx: .11 },
  management: { lights: [.34, .7], baseExposure: .68, minExposure: .52, maxExposure: .86, contrast: 1.01, saturation: .76, temperature: -.24, localLightBoost: .16, lightRadius: .29, shadowOpacity: .39, shadowBlurPx: 2.7, shadowReachPx: 62, edgeSoftnessPx: .14 },
  b1: { lights: [.2, .68], baseExposure: .59, minExposure: .46, maxExposure: .75, contrast: 1.1, saturation: .52, temperature: .26, localLightBoost: .13, lightRadius: .23, shadowOpacity: .45, shadowBlurPx: 2.2, shadowReachPx: 70, edgeSoftnessPx: .13 },
  b2: { lights: [.18, .5, .84], baseExposure: .55, minExposure: .43, maxExposure: .7, contrast: 1.12, saturation: .48, temperature: .38, localLightBoost: .12, lightRadius: .2, shadowOpacity: .48, shadowBlurPx: 2, shadowReachPx: 78, edgeSoftnessPx: .12 },
  clinic: { lights: [.3, .72], baseExposure: .66, minExposure: .5, maxExposure: .8, contrast: 1.06, saturation: .6, temperature: .22, localLightBoost: .13, lightRadius: .25, shadowOpacity: .42, shadowBlurPx: 2.3, shadowReachPx: 66, edgeSoftnessPx: .13 },
};

const SCENE_COLOR_GRADES: Record<SceneLightingContext, { multiply: readonly [number, number, number]; softLight: readonly [number, number, number]; strength: number }> = {
  hallway: { multiply: [124, 116, 104], softLight: [140, 130, 114], strength: .09 },
  room: { multiply: [139, 119, 91], softLight: [162, 132, 94], strength: .1 },
  elevator: { multiply: [118, 114, 106], softLight: [134, 128, 116], strength: .11 },
  management: { multiply: [135, 111, 86], softLight: [158, 127, 91], strength: .1 },
  b1: { multiply: [112, 108, 100], softLight: [128, 122, 111], strength: .12 },
  b2: { multiply: [108, 104, 96], softLight: [124, 118, 108], strength: .13 },
  clinic: { multiply: [120, 116, 106], softLight: [136, 130, 116], strength: .11 },
};

export const UI_THEME = {
  textPrimary: "#d6c9a8", textSecondary: "#918873", warning: "#b68c52", danger: "#8b3932",
  selected: "#d1ad70", disabled: "#5e5c54", panelDark: "#11140f", paper: "#b8ab8d",
  panelFadeMs: 200, updateHighlightMs: 650,
} as const;

export function getTimePeriod(secondsRemaining: number): TimePeriod {
  const elapsed = GAME_DAY_SECONDS - Math.max(0, Math.min(GAME_DAY_SECONDS, secondsRemaining));
  if (elapsed < 240) return "daylight";
  if (elapsed < 420) return "evening";
  if (elapsed < 630) return "curfew_night";
  return "uncanny_dawn";
}

export const getTimePeriodIndex = (secondsRemaining: number) => TIME_PERIOD_ORDER.indexOf(getTimePeriod(secondsRemaining));
export const getTimePeriodLabel = (secondsRemaining: number) => TIME_PERIOD_LABELS[getTimePeriod(secondsRemaining)];

export function isPatrolLightPeriod(secondsRemaining: number) {
  const period = getTimePeriod(secondsRemaining);
  return period === "curfew_night" || period === "uncanny_dawn";
}

export function isPatrolLightManifested(nowMs: number, phase: number, hp: number, secondsRemaining: number) {
  if (hp <= 0) return true;
  if (!isPatrolLightPeriod(secondsRemaining)) return false;
  const outageChance = TIME_PERIOD_PROFILES[getTimePeriod(secondsRemaining)].outageChance;
  const unstableLight = Math.sin(nowMs / 520 + phase * 2.7) + Math.sin(nowMs / 170 + phase * 5.3) * .55;
  return unstableLight > -.55 + outageChance * 1.15;
}

const clampValue = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function resolveSceneLightingContext(
  location: Location,
  state: { activeBoss?: "boss_b1" | "boss_b2" | null; managementOffice?: boolean; clinic?: boolean } = {},
): SceneLightingContext {
  if (state.activeBoss === "boss_b1") return "b1";
  if (state.activeBoss === "boss_b2") return "b2";
  if (state.managementOffice) return "management";
  if (state.clinic) return "clinic";
  return location;
}

export function sampleCharacterLighting(context: SceneLightingContext, normalizedX: number, secondsRemaining: number): CharacterLightingSample {
  const period = TIME_PERIOD_PROFILES[getTimePeriod(secondsRemaining)];
  const profile = CHARACTER_LIGHTING_PROFILES[context];
  const x = clampValue(normalizedX, 0, 1);
  const nearestLight = profile.lights.reduce((nearest, light) => Math.abs(light - x) < Math.abs(nearest - x) ? light : nearest, profile.lights[0]);
  const distance = Math.abs(nearestLight - x);
  const localLight = clampValue(1 - distance / profile.lightRadius, 0, 1) * profile.localLightBoost * period.practicalIntensity;
  const periodExposure = .72 + period.exposure * .28;
  const exposure = clampValue(profile.baseExposure * periodExposure + localLight, profile.minExposure, profile.maxExposure);
  const darkness = 1 - period.exposure;
  const temperature = clampValue(profile.temperature + period.cold * .45, -1, 1);

  return {
    exposure,
    contrast: clampValue(profile.contrast + darkness * .08, .92, 1.18),
    saturation: clampValue(profile.saturation - darkness * .08, .56, .86),
    blackPoint: clampValue(.08 + darkness * .16 + (1 - exposure) * .1, .08, .28),
    temperature,
    colorNeutralization: .84,
    sepia: .2,
    hueRotateDeg: -14,
    edgeSoftnessPx: profile.edgeSoftnessPx + darkness * .04,
    shadowOpacity: clampValue(profile.shadowOpacity + darkness * .1, .3, .56),
    shadowBlurPx: profile.shadowBlurPx + (1 - localLight / Math.max(profile.localLightBoost, .01)) * .45,
    shadowOffsetX: clampValue((x - nearestLight) * profile.shadowReachPx, -28, 28),
  };
}

export function sampleSceneColorGrade(context: SceneLightingContext, secondsRemaining: number): SceneColorGrade {
  const period = TIME_PERIOD_PROFILES[getTimePeriod(secondsRemaining)];
  const grade = SCENE_COLOR_GRADES[context];
  const darkness = 1 - period.exposure;
  return {
    multiply: grade.multiply,
    multiplyOpacity: clampValue(grade.strength + darkness * .08, .08, .2),
    softLight: grade.softLight,
    softLightOpacity: clampValue(grade.strength * .55 + Math.abs(period.cold) * .04, .04, .12),
  };
}

export function toCharacterCanvasFilter(sample: CharacterLightingSample, exposureMultiplier = 1) {
  const exposure = clampValue(sample.exposure * exposureMultiplier * (1 - sample.blackPoint * .08), .38, 1);
  const contrast = clampValue(sample.contrast + sample.blackPoint * .12, .92, 1.2);
  return `brightness(${exposure.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${sample.saturation.toFixed(3)}) grayscale(${sample.colorNeutralization.toFixed(3)}) sepia(${sample.sepia.toFixed(3)}) hue-rotate(${sample.hueRotateDeg}deg) blur(${sample.edgeSoftnessPx.toFixed(2)}px)`;
}

export type CharacterAnimationPose = "idle" | "walk" | "attack" | "hit" | "death";

const PLAYER_ANIMATION_EXPOSURE: Record<"male" | "female", Record<CharacterAnimationPose, number>> = {
  male: { idle: 1, walk: .74, attack: .9, hit: .94, death: .94 },
  female: { idle: 1, walk: .92, attack: .94, hit: .95, death: .95 },
};

const ENEMY_ANIMATION_EXPOSURE: Record<CharacterAnimationPose, number> = {
  idle: 1,
  walk: .82,
  attack: .88,
  hit: .9,
  death: .92,
};

export function getEnemyAnimationExposureMultiplier(pose: CharacterAnimationPose) {
  return ENEMY_ANIMATION_EXPOSURE[pose];
}

export function getPlayerAnimationExposureMultiplier(gender: "male" | "female", pose: CharacterAnimationPose) {
  return PLAYER_ANIMATION_EXPOSURE[gender][pose];
}

export function sampleCharacterExposure(location: Location, normalizedX: number, secondsRemaining: number) {
  return sampleCharacterLighting(location, normalizedX, secondsRemaining).exposure;
}
