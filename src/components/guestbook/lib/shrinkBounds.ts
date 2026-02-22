/**
 * Server-side bound shrinking for guestbook notes.
 *
 * Uses font-size-aware character estimation for Grand9KPixel (monospace pixel font)
 * to find the minimum rowSpan x colSpan that fits the text + author.
 *
 * Key insight: font size depends on rowSpan (Math.max(0.65, Math.min(0.85, rowSpan * 0.2))).
 * Smaller rowSpan = smaller font = more characters fit per column.
 * The estimation scales chars-per-column inversely with font size.
 */

// Characters per column at the largest font size (0.85rem).
// Scales up at smaller fonts (e.g., at 0.65rem → ~3.9 chars/col).
const BASE_CHARS_PER_COL = 3;
const REFERENCE_FONT_SIZE = 0.85;
// Horizontal note padding (~12px) eats roughly 1 column unit of character space
const PADDING_CHARS = 1;
// Row height estimate in px (moderate — works for tablet/desktop)
const MIN_ROW_HEIGHT_PX = 20;
// Note vertical padding: 4px top + 4px bottom
const NOTE_PADDING_VERTICAL_PX = 8;
// Root font size assumed 16px
const ROOT_FONT_SIZE_PX = 16;

/** Matches NoteRenderer.svelte computeFontSize exactly */
function computeFontSize(rowSpan: number): number {
  return Math.max(0.65, Math.min(0.85, rowSpan * 0.2));
}

/**
 * Estimate characters per line for a given column span and font size.
 * Smaller fonts = narrower characters = more fit per column.
 */
function estimateCharsPerLine(colSpan: number, fontSize: number): number {
  const scaledCharsPerCol = BASE_CHARS_PER_COL * (REFERENCE_FONT_SIZE / fontSize);
  return Math.max(1, Math.floor(colSpan * scaledCharsPerCol - PADDING_CHARS));
}

/** Count lines needed when word-wrapping text into a fixed character width */
function countWrappedLines(text: string, charsPerLine: number): number {
  if (charsPerLine <= 0) return Infinity;
  if (text.length === 0) return 0;

  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return 0;

  let lines = 1;
  let lineLen = 0;

  for (const word of words) {
    if (word.length > charsPerLine) {
      // Word longer than line — force break (matches CSS word-break: break-word)
      if (lineLen > 0) {
        lines++;
        lineLen = 0;
      }
      lines += Math.ceil(word.length / charsPerLine) - 1;
      lineLen = word.length % charsPerLine || charsPerLine;
    } else if (lineLen > 0 && lineLen + 1 + word.length > charsPerLine) {
      // Word doesn't fit on current line
      lines++;
      lineLen = word.length;
    } else {
      lineLen += (lineLen > 0 ? 1 : 0) + word.length;
    }
  }

  return lines;
}

/** Check if text + author fits in a given rowSpan x colSpan area */
function textFitsInArea(
  text: string,
  author: string,
  rowSpan: number,
  colSpan: number,
): boolean {
  const fontSize = computeFontSize(rowSpan);
  const charsPerLine = estimateCharsPerLine(colSpan, fontSize);

  const textLines = countWrappedLines(text, charsPerLine);
  // At 1 row, author is clipped — don't count it
  const totalLines = rowSpan <= 1 ? textLines : textLines + 1;

  // Available lines based on row height and font size
  const fontSizePx = fontSize * ROOT_FONT_SIZE_PX;
  const lineHeightPx = fontSizePx * 1.4;
  // Reduce padding for 1-row notes (no room for full padding)
  const padding = rowSpan <= 1 ? 2 : NOTE_PADDING_VERTICAL_PX;
  const totalHeight = rowSpan * MIN_ROW_HEIGHT_PX - padding;
  const availableLines = Math.floor(totalHeight / lineHeightPx);

  return totalLines <= availableLines;
}

export interface Bounds {
  row_start: number;
  row_end: number;
  col_start: number;
  col_end: number;
}

/**
 * Shrink note bounds to the minimum area that fits the text + author.
 * Anchors at top-left: only row_end and col_end decrease.
 * Returns original bounds if already at minimum or text fills the space.
 */
export function shrinkBounds(
  text: string,
  author: string,
  bounds: Bounds,
): Bounds {
  const maxRowSpan = bounds.row_end - bounds.row_start;
  const maxColSpan = bounds.col_end - bounds.col_start;

  // Already at minimum (1 row, 2 cols)
  if (maxRowSpan <= 1 && maxColSpan <= 2) return bounds;

  // Iterate from smallest area: rows outer, cols inner
  // At smaller rowSpans, font is smaller → more chars fit → finds tighter bounds
  for (let rowSpan = 1; rowSpan <= maxRowSpan; rowSpan++) {
    for (let colSpan = 2; colSpan <= maxColSpan; colSpan++) {
      if (textFitsInArea(text, author, rowSpan, colSpan)) {
        return {
          row_start: bounds.row_start,
          row_end: bounds.row_start + rowSpan,
          col_start: bounds.col_start,
          col_end: bounds.col_start + colSpan,
        };
      }
    }
  }

  // Fallback: original bounds (text fills entire selection)
  return bounds;
}
