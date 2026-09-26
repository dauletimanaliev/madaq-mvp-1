import { getDocumentProxy } from "unpdf";

export type TextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  dir?: string;
  hasEOL?: boolean;
};

type FontStyle = "normal" | "bold" | "italic" | "bolditalic";

type Line = {
  y: number;
  items: TextItem[];
  avgFontSize: number;
  isAllCaps: boolean;
  isCentered: boolean;
  isItalic: boolean;
  isBold: boolean;
  text: string;
  x: number;
  maxX: number;
};

export function detectFontStyle(fontName: string): FontStyle {
  const lower = (fontName || "").toLowerCase();
  const isBold =
    lower.includes("bold") ||
    lower.includes("heavy") ||
    lower.includes("black") ||
    lower.includes("semibold") ||
    lower.includes("demibold") ||
    lower.includes("boldcn");
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
  // Preserve leading/trailing spaces outside formatting markers
  const leadingSpace = text.match(/^\s*/)?.[0] || "";
  const trailingSpace = text.match(/\s*$/)?.[0] || "";
  const clean = text.trim();
  if (!clean) return text;

  switch (style) {
    case "bold":
      return `${leadingSpace}**${clean}**${trailingSpace}`;
    case "italic":
      return `${leadingSpace}*${clean}*${trailingSpace}`;
    case "bolditalic":
      return `${leadingSpace}***${clean}***${trailingSpace}`;
    default:
      return text;
  }
}

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
  let bodySize = 14;
  for (const [size, count] of sizeCount) {
    if (count > maxCount) {
      maxCount = count;
      bodySize = size;
    }
  }
  return bodySize;
}

function findPageBounds(pages: TextItem[][]): { minX: number; maxX: number } {
  let minX = 9999;
  let maxX = 0;
  for (const page of pages) {
    for (const item of page) {
      if (!item.str.trim()) continue;
      if (item.x < minX) minX = item.x;
      const right = item.x + item.width;
      if (right > maxX) maxX = right;
    }
  }
  return { minX: minX === 9999 ? 70 : minX, maxX: maxX === 0 ? 550 : maxX };
}

function findBodyLeftMargin(pages: TextItem[][]): number {
  const xCount = new Map<number, number>();
  for (const page of pages) {
    for (const item of page) {
      if (!item.str.trim() || item.str.length < 5) continue;
      const rounded = Math.round(item.x);
      xCount.set(rounded, (xCount.get(rounded) || 0) + 1);
    }
  }

  let maxCount = 0;
  let bodyX = 77;
  for (const [x, count] of xCount) {
    if (count > maxCount) {
      maxCount = count;
      bodyX = x;
    }
  }
  return bodyX;
}

function groupIntoLines(items: TextItem[], pageWidth: number): Line[] {
  if (items.length === 0) return [];

  // Sort items primarily by Y descending (PDF coordinates usually go bottom-to-top or top-to-bottom)
  // In PDF.js transform[5] is Y from bottom, so higher Y is higher on page
  const sorted = [...items].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 3) return yDiff;
    return a.x - b.x;
  });

  const lines: Line[] = [];
  let currentItems: TextItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const yDiff = Math.abs(currentY - item.y);

    if (yDiff <= (item.fontSize || 12) * 0.35) {
      currentItems.push(item);
    } else {
      // Sort items within the line by X ascending
      currentItems.sort((a, b) => a.x - b.x);
      lines.push(buildLine(currentItems, pageWidth));
      currentItems = [item];
      currentY = item.y;
    }
  }

  if (currentItems.length > 0) {
    currentItems.sort((a, b) => a.x - b.x);
    lines.push(buildLine(currentItems, pageWidth));
  }

  return lines;
}

function buildLine(items: TextItem[], pageWidth: number): Line {
  const text = items.map((it) => it.str).join("");
  const avgFontSize =
    items.reduce((sum, it) => sum + it.fontSize, 0) / items.length;

  const trimmedText = text.trim();
  const isAllCaps =
    trimmedText.length > 2 &&
    trimmedText === trimmedText.toUpperCase() &&
    /[A-ZА-ЯЁ]/.test(trimmedText);

  const lineX = items[0]?.x || 0;
  const lastItem = items[items.length - 1];
  const maxX = lastItem ? lastItem.x + lastItem.width : lineX;
  const lineWidth = maxX - lineX;
  const centerX = lineX + lineWidth / 2;
  const pageCenterX = pageWidth / 2;
  const isCentered =
    Math.abs(centerX - pageCenterX) < pageWidth * 0.12 &&
    lineWidth < pageWidth * 0.75;

  const styles = items.map((it) => detectFontStyle(it.fontFamily));
  const isBold = styles.some((s) => s === "bold" || s === "bolditalic");
  const isItalic =
    styles.every((s) => s === "italic" || s === "bolditalic") &&
    trimmedText.length > 0;

  return {
    y: items[0].y,
    items,
    avgFontSize,
    isAllCaps,
    isCentered,
    isItalic,
    isBold,
    text: trimmedText,
    x: lineX,
    maxX,
  };
}

/**
 * Converts lines of a page into structured markdown-compatible text.
 */
export function pdfItemsToFormattedText(pages: TextItem[][]): string {
  const bodyFontSize = findBodyFontSize(pages);
  const bodyLeftMargin = findBodyLeftMargin(pages);
  const { minX, maxX } = findPageBounds(pages);
  const pageWidth = maxX + minX;

  const headingThreshold = bodyFontSize * 1.25;
  const subheadingThreshold = bodyFontSize * 1.05;

  const output: string[] = [];

  for (const pageItems of pages) {
    if (pageItems.length === 0) continue;

    const lines = groupIntoLines(pageItems, pageWidth);
    if (lines.length === 0) continue;

    let paragraphBuffer = "";

    const flushParagraph = () => {
      if (paragraphBuffer.trim()) {
        output.push(paragraphBuffer.trim());
        output.push("\n\n");
      }
      paragraphBuffer = "";
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const prevLine = i > 0 ? lines[i - 1] : null;

      if (!line.text) continue;

      // Skip running headers and page numbers
      // Running header: very high on page (y > 720) or very low (y < 70) and short/page number
      if (/^\d+$/.test(line.text) && (line.isCentered || line.y < 75 || line.y > 730)) {
        continue;
      }

      // Check line types
      const isChapterLabel =
        line.isAllCaps &&
        /^(CHAPTER|ГЛАВА|ЧАСТЬ|PART|INTRODUCTION|ВСТУПЛЕНИЕ|PROLOGUE|ПРОЛОГ|EPILOGUE|ЭПИЛОГ|CONCLUSION|ЗАКЛЮЧЕНИЕ)\s*[0-9IVXLCDM]*\s*$/i.test(
          line.text
        );

      const isLargeHeading = line.avgFontSize >= headingThreshold;
      const isSubheading =
        !isLargeHeading &&
        line.isCentered &&
        line.avgFontSize >= subheadingThreshold &&
        line.text.length < 80;

      const isEpigraph =
        line.isItalic &&
        !isLargeHeading &&
        (line.isCentered || line.x > bodyLeftMargin + 15);

      const isAttribution =
        (line.text.startsWith("—") || line.text.startsWith("-")) &&
        line.text.length < 50;

      // Detect paragraph start
      const isIndented = line.x > bodyLeftMargin + 10;
      let isVerticalGap = false;
      if (prevLine) {
        const lineGap = Math.abs(prevLine.y - line.y);
        const normalGap = bodyFontSize * 1.5;
        isVerticalGap = lineGap > normalGap * 1.35;
      }

      const isNewSection =
        isChapterLabel ||
        isLargeHeading ||
        isSubheading ||
        isEpigraph ||
        isAttribution;

      if (isNewSection) {
        flushParagraph();

        if (isChapterLabel) {
          output.push(`### ${line.text}\n\n`);
        } else if (isLargeHeading) {
          output.push(`## ${line.text}\n\n`);
        } else if (isSubheading) {
          output.push(`### ${line.text}\n\n`);
        } else if (isEpigraph) {
          output.push(`> *${line.text}*\n\n`);
        } else if (isAttribution) {
          output.push(`> ${line.text}\n\n`);
        }
        continue;
      }

      // Body text handling
      if (isIndented || isVerticalGap) {
        flushParagraph();
      }

      // Format items inside this line with inline styles
      let lineFormatted = "";
      for (const item of line.items) {
        if (!item.str) continue;
        const style = detectFontStyle(item.fontFamily);
        let part = item.str;

        if (style !== "normal") {
          part = wrapInline(part, style);
        }
        lineFormatted += part;
      }

      if (paragraphBuffer.length > 0) {
        // Append to existing paragraph with a space
        // Check if previous line ended with a hyphen for word breaks
        if (paragraphBuffer.endsWith("-")) {
          paragraphBuffer = paragraphBuffer.slice(0, -1) + lineFormatted.trimStart();
        } else {
          paragraphBuffer += " " + lineFormatted.trim();
        }
      } else {
        paragraphBuffer = lineFormatted.trim();
      }
    }

    flushParagraph();
    output.push("\n\n");
  }

  return output
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\*\*\s*\*\*/g, " ")
    .replace(/\*\s*\*/g, " ")
    .trim();
}

/**
 * Extracts formatted text from PDF binary data, resolving actual font names
 * (including bold, italic, and medium weights) directly from PDF font objects.
 */
export async function extractPdfWithFormatting(
  pdfData: Uint8Array
): Promise<string> {
  const dataCopy = new Uint8Array(
    pdfData.buffer.slice(
      pdfData.byteOffset,
      pdfData.byteOffset + pdfData.byteLength
    )
  );
  const pdf = await getDocumentProxy(dataCopy);
  const pages: TextItem[][] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    // Force operator list evaluation so page.commonObjs is populated with font info
    await page.getOperatorList();
    const textContent = await page.getTextContent();

    // Map internal font IDs to real font names (e.g. LiberationSerif-Italic)
    const fontNames: Record<string, string> = {};
    for (const fontId of Object.keys(textContent.styles)) {
      await new Promise<void>((resolve) => {
        if (page.commonObjs.has(fontId)) {
          page.commonObjs.get(fontId, (f: { name?: string } | null) => {
            if (f?.name) fontNames[fontId] = f.name;
            resolve();
          });
        } else {
          resolve();
        }
      });
    }

    const items: TextItem[] = [];
    for (const it of textContent.items as Array<{
      str?: string;
      fontName: string;
      transform: number[];
      width: number;
      height: number;
      dir: string;
      hasEOL: boolean;
    }>) {
      if (!it.str) continue;
      const realFont =
        fontNames[it.fontName] ||
        it.fontName ||
        textContent.styles[it.fontName]?.fontFamily ||
        "";

      items.push({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        width: it.width,
        height: it.height,
        fontSize: Math.hypot(it.transform[0], it.transform[1]),
        fontFamily: realFont,
        dir: it.dir,
        hasEOL: it.hasEOL,
      });
    }

    pages.push(items);
  }

  return pdfItemsToFormattedText(pages);
}
