/** Default ramp curve for a given number of months (0–1 per month). */
export function defaultRampPatternForMonths(months: number): number[] {
  if (months <= 0) return [];
  if (months === 3) return [0.5, 0.75, 1];
  if (months === 4) return [0.25, 0.5, 0.75, 1];
  return Array(months).fill(1 / months);
}
