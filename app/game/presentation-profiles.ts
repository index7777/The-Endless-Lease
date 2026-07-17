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

export function sampleCharacterExposure(location: Location, normalizedX: number, secondsRemaining: number) {
  const period = TIME_PERIOD_PROFILES[getTimePeriod(secondsRemaining)];
  const scene = SCENE_PRESENTATION[location];
  const nearest = Math.min(...scene.lights.map(light => Math.abs(light - normalizedX)));
  const localLight = Math.max(0, 1 - nearest * 4.2) * .2 * period.practicalIntensity;
  return Math.max(.52, scene.characterExposure * period.exposure + localLight);
}
