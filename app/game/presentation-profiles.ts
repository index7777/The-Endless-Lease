import type { Location } from "./model";

export type TimePeriod = "morning" | "day" | "evening" | "night" | "deep_night";
export const TIME_PERIOD_PROFILES: Record<TimePeriod, { exposure: number; cold: number; practicalIntensity: number; outageChance: number }> = {
  morning: { exposure: .94, cold: .08, practicalIntensity: .86, outageChance: 0 },
  day: { exposure: 1, cold: .12, practicalIntensity: 1, outageChance: 0 },
  evening: { exposure: .88, cold: -.08, practicalIntensity: .92, outageChance: .08 },
  night: { exposure: .72, cold: .15, practicalIntensity: .78, outageChance: .18 },
  deep_night: { exposure: .58, cold: .24, practicalIntensity: .61, outageChance: .34 },
};

export const SCENE_PRESENTATION = {
  hallway: { profile: "hallway_fluorescent", lights: [.22, .51, .82], wetReflection: .34, characterExposure: .96 },
  room: { profile: "resident_tungsten_fluorescent", lights: [.55], wetReflection: .12, characterExposure: .9 },
  elevator: { profile: "elevator_cold_metal", lights: [.5], wetReflection: .27, characterExposure: .92 },
} satisfies Record<Location, { profile: string; lights: number[]; wetReflection: number; characterExposure: number }>;

export const UI_THEME = {
  textPrimary: "#d6c9a8", textSecondary: "#918873", warning: "#b68c52", danger: "#8b3932",
  selected: "#d1ad70", disabled: "#5e5c54", panelDark: "#11140f", paper: "#b8ab8d",
  panelFadeMs: 200, updateHighlightMs: 650,
} as const;

export function getTimePeriod(secondsRemaining: number): TimePeriod {
  const elapsed = 720 - secondsRemaining;
  if (elapsed < 90) return "morning";
  if (elapsed < 260) return "day";
  if (elapsed < 410) return "evening";
  if (elapsed < 590) return "night";
  return "deep_night";
}

export function sampleCharacterExposure(location: Location, normalizedX: number, secondsRemaining: number) {
  const period = TIME_PERIOD_PROFILES[getTimePeriod(secondsRemaining)];
  const scene = SCENE_PRESENTATION[location];
  const nearest = Math.min(...scene.lights.map(light => Math.abs(light - normalizedX)));
  const localLight = Math.max(0, 1 - nearest * 4.2) * .2 * period.practicalIntensity;
  return Math.max(.52, scene.characterExposure * period.exposure + localLight);
}

