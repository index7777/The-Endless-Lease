export const HOME_STORAGE_X = 720;
// Match the visible bed and leave a reachable lane in front of its collider.
export const HOME_BED_RANGE = [820, 1340] as const;
export const HOME_BED_LABEL_X = 1090;

export function horizontalDistanceToRange(x: number, range: readonly [number, number]) {
  if (x < range[0]) return range[0] - x;
  if (x > range[1]) return x - range[1];
  return 0;
}

export function resolveHomeInteraction(x: number): { kind: "bed" | "storage"; distance: number } {
  const bedDistance = horizontalDistanceToRange(x, HOME_BED_RANGE);
  const storageDistance = Math.abs(x - HOME_STORAGE_X);
  return bedDistance <= storageDistance
    ? { kind: "bed", distance: bedDistance }
    : { kind: "storage", distance: storageDistance };
}
