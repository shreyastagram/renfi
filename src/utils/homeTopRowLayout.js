/**
 * Layout for the Provider Home top row (verification → map → Online).
 * Pure so it can be tested across phone widths and font scales.
 */

export const TOP_ROW_GAP = 10;
export const TOP_ROW_FONT_SCALE = 1.2;
export const MIN_MAP_WIDTH = 104;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * @param {{ width: number, fontScale?: number, showVerification: boolean }} input
 *   width: the row's usable width (screen width minus page padding)
 * @returns {{ tileHeight: number, sideWidth: number, toggleWidth: number, mapWidth: number, stacked: boolean }}
 *   stacked: the map would be too narrow, so it moves to its own full-width line
 */
export function computeTopRowLayout({ width, fontScale = 1, showVerification }) {
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const tileHeight = Math.round(92 * clamp(scale, 1, TOP_ROW_FONT_SCALE));
  const widthScale = clamp(scale, 1, 1.1);
  const sideWidth = Math.round(clamp(width * 0.25, 78, 100) * widthScale);
  const toggleWidth = Math.round(clamp(width * 0.26, 82, 108) * widthScale);
  const mapWidth = width - toggleWidth - TOP_ROW_GAP - (showVerification ? sideWidth + TOP_ROW_GAP : 0);
  return { tileHeight, sideWidth, toggleWidth, mapWidth, stacked: mapWidth < MIN_MAP_WIDTH };
}
