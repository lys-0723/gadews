/** NOAA NMME centres are integer degrees: rows -90..90, columns 0..359 E; ties select the lower centre as in the collector. */
export function heatColumn(longitude: number) {
  return ((Math.ceil(longitude - 0.5) % 360) + 360) % 360;
}
export function heatRow(latitude: number) {
  return 90 + Math.max(-90, Math.min(90, Math.ceil(latitude - 0.5)));
}
export const heatColors = ["#fee8ac", "#faae61", "#e75b35", "#a4263c"];
export function heatClass(probability: number) {
  return Math.min(3, Math.floor(probability / 25));
}
