/**
 * Converts raw PDF text items (with font metadata and positions) into
 * formatted text with lightweight markdown-like markers:
 *   **bold text**
 *   *italic text*
 *   ## Heading
 *
 * Also reconstructs proper paragraphs from positional data (Y-gaps).
 */

export type TextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  dir: string;
  hasEOL: boolean;
};

type FontStyle = "normal" | "bold" | "italic" | "bolditalic";

function detectFontStyle(fontFamily: string): FontStyle {
  const lower = fontFamily.toLowerCase();
  const isBold =
    lower.includes("bold") ||
    lower.includes("heavy") ||
    lower.includes("black") ||
    lower.includes("semibold") ||
    lower.includes("demibold");
  const isItalic =
    lower.includes("italic") ||
    lower.includes("oblique") ||
    lower.includes("slant");

  if (isBold && isItalic) return "bolditalic";
  if (isBold) return "bold";
  if (isItalic) return "italic";
  return "normal";
}

function wrapInline(text: string, style: FontStyle): string {
  if (!text.trim()) return text;
  switch (style) {
    case "bold":
      return `**${text}**`;
    case "italic":
      return `*${text}*`;
    case "bolditalic":
      return `***${text}***`;
    default:
      return text;
  }
}

/**
 * Determine the dominant (most frequent) font size in the document
 * to distinguish body text from headings.
 */
function findBodyFontSize(pages: TextItem[][]): number {
  const sizeCount = new Map<number, number>();
  for (const page of pages) {
    for (const item of page) {
      if (!item.str.trim()) continue;
      const rounded = Math.round(item.fontSize * 10) / 10;
      sizeCount.set(rounded, (sizeCount.get(rounded) || 0) + item.str.length);
    }
  }

  let maxCount = 0;
  let bodySize = 12;
  for (const [size, count] of sizeCount) {
    if (count > maxCount) {
      maxCount = count;
      bodySize = size;
    }
  }

  return bodySize;
}

/**
 * Determine the typical left-margin (X position) for body text.
 */
function findBodyLeftMargin(pages: TextItem[][]): number {
  const xCount = new Map<number, number>();
  for (const page of pages) {
    for (const item of page) {
      if (!item.str.trim()) continue;
      const rounded = Math.round(item.x);
      xCount.set(rounded, (xCount.get(rounded) || 0) + 1);
    }
  }

  let maxCount = 0;
  let bodyX = 0;
  for (const [x, count] of xCount) {
    if (count > maxCount) {
      maxCount = count;
      bodyX = x;
    }
  }
  return bodyX;
}

/**
 * Convert an array of pages (each containing TextItems) into formatted text.
 *
 * Strategy:
 * - Items on the same line (similar Y) are concatenated with spaces
 * - Large Y-gaps between lines → paragraph break (\n\n)
 * - Font size significantly larger than body → heading (##)
 * - Bold/italic font names → **bold** / *italic*
 * - Indented lines → potentially new paragraph
 */
export function pdfItemsToFormattedText(pages: TextItem[][]): string {
  const bodyFontSize = findBodyFontSize(pages);
  const bodyLeftMargin = findBodyLeftMargin(pages);
  const headingThreshold = bodyFontSize * 1.15; // 15% larger = heading

  const output: string[] = [];

  for (const pageItems of pages) {
    if (pageItems.length === 0) continue;

    // Group items into lines by Y-position
    const lines: { y: number; items: TextItem[] }[] = [];
    let currentLine: { y: number; items: TextItem[] } | null = null;

    for (const item of pageItems) {
      if (!currentLine || Math.abs(currentLine.y - item.y) > item.fontSize * 0.3) {
        currentLine = { y: item.y, items: [] };
        lines.push(currentLine);
      }
      currentLine.items.push(item);
    }

    // Process lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const prevLine = lines[i - 1];

      // Detect paragraph break: large vertical gap between lines
      if (prevLine) {
        const lineGap = Math.abs(prevLine.y - line.y);
        const avgFontSize =
          (prevLine.items[0]?.fontSize || bodyFontSize + line.items[0]?.fontSize || bodyFontSize) / 2;
        const normalLineHeight = avgFontSize * 1.5;

        if (lineGap > normalLineHeight * 1.4) {
          // Large gap → paragraph break
          output.push("\n\n");
        } else {
          // Same paragraph, just a line break → space
          output.push(" ");
        }
      }

      // Check if this line is a heading (larger font size)
      const lineAvgFontSize =
        line.items.reduce((sum, it) => sum + it.fontSize, 0) / line.items.length;
      const isHeading = lineAvgFontSize > headingThreshold;

      // Check if line is indented (could be a new paragraph start)
      const lineX = line.items[0]?.x || 0;
      const isIndented = lineX > bodyLeftMargin + bodyFontSize * 1.5;

      // If indented and previous output doesn't end with \n\n, add paragraph break
      if (isIndented && output.length > 0) {
        const lastChunk = output[output.length - 1];
        if (lastChunk !== "\n\n") {
          output.push("\n\n");
        }
      }

      if (isHeading) {
        // Make sure heading starts on a new line
        if (output.length > 0 && output[output.length - 1] !== "\n\n") {
          output.push("\n\n");
        }
        output.push("## ");
      }

      // Build line text with inline formatting
      let prevStyle: FontStyle | null = null;
      for (const item of line.items) {
        const text = item.str;
        if (!text) continue;

        const style = detectFontStyle(item.fontFamily);

        if (style !== prevStyle && style !== "normal" && !isHeading) {
          output.push(wrapInline(text, style));
        } else {
          output.push(text);
        }

        prevStyle = style;
      }

      if (isHeading) {
        output.push("\n\n");
      }
    }

    // Page break → paragraph break
    output.push("\n\n");
  }

  return output
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}
