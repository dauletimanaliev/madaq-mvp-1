export type ParsedChapter = {
  number: number;
  title: string | null;
  content: string;
};

export type ParsedBook = {
  title?: string;
  author?: string;
  description?: string;
  chapters: ParsedChapter[];
};

/**
 * Normalizes chapter content: removes excessive line breaks, trims whitespace.
 */
export function normalizeContent(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Parses markdown or text content into chapters.
 * Matches patterns like:
 *   ### CHAPTER 1
 *   ## Chapter 2
 *   # Глава 1: Название
 *   Глава 3. Встреча
 *   ГЛАВА 4
 */
export function parseBookText(rawText: string, defaultTitle?: string): ParsedBook {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  // Pattern for chapter headings:
  // Starts with line start or newline, optional markdown header (#, ##, ###),
  // followed by "Глава", "Chapter", "ЧАСТЬ", "INTRODUCTION", etc.
  const chapterRegex =
    /(?:^|\n)(?:(#{1,3})\s+)?(Глава|ГЛАВА|глава|Chapter|CHAPTER|Часть|ЧАСТЬ|INTRODUCTION|ВСТУПЛЕНИЕ|PROLOGUE|ПРОЛОГ|EPILOGUE|ЭПИЛОГ|CONCLUSION|ЗАКЛЮЧЕНИЕ)(?:\s+([0-9IVXLCDM]+|[а-яёА-ЯЁ\w]+))?(?::|\.|\s-|\s—)?\s*([^\n]*)/g;

  type RawMatch = {
    index: number;
    length: number;
    hasMdHash: boolean;
    keyword: string;
    numberStr: string;
    titleStr: string;
    fullMatch: string;
  };

  let allMatches: RawMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = chapterRegex.exec(text)) !== null) {
    allMatches.push({
      index: match.index,
      length: match[0].length,
      hasMdHash: Boolean(match[1]),
      keyword: match[2],
      numberStr: (match[3] || "").trim(),
      titleStr: (match[4] || "").trim(),
      fullMatch: match[0].trim(),
    });
  }

  // Filter out Table of Contents matches:
  // In a TOC, chapter headers appear in rapid succession (distance between consecutive markers < 250 chars)
  const validMatches: RawMatch[] = [];
  for (let i = 0; i < allMatches.length; i++) {
    const cur = allMatches[i];
    const nxt = allMatches[i + 1];

    // If next match is within 250 characters, it's almost certainly a TOC line or duplicate
    if (nxt && nxt.index - cur.index < 250) {
      continue;
    }

    validMatches.push(cur);
  }

  // Fallback: If no valid chapter headers found, try splitting by top-level Markdown headers `## `
  if (validMatches.length < 2) {
    const mdHeaderRegex = /(?:^|\n)#{1,2}\s+([^\n]+)/g;
    const mdMatches: RawMatch[] = [];
    while ((match = mdHeaderRegex.exec(text)) !== null) {
      mdMatches.push({
        index: match.index,
        length: match[0].length,
        hasMdHash: true,
        keyword: "Chapter",
        numberStr: "",
        titleStr: (match[1] || "").trim(),
        fullMatch: match[0].trim(),
      });
    }

    // Filter TOC from mdMatches as well
    for (let i = 0; i < mdMatches.length; i++) {
      const cur = mdMatches[i];
      const nxt = mdMatches[i + 1];
      if (nxt && nxt.index - cur.index < 250) continue;
      validMatches.push(cur);
    }
  }

  // If still no chapters found, treat entire text as a single chapter
  if (validMatches.length === 0) {
    return {
      title: defaultTitle || "Без названия",
      chapters: [
        {
          number: 1,
          title: defaultTitle || "Глава 1",
          content: normalizeContent(text),
        },
      ],
    };
  }

  const chapters: ParsedChapter[] = [];

  for (let i = 0; i < validMatches.length; i++) {
    const current = validMatches[i];
    const next = validMatches[i + 1];

    // Content includes the chapter heading at the top for rich reader display
    const contentStart = current.index;
    const contentEnd = next ? next.index : text.length;
    const chapterRawContent = text.slice(contentStart, contentEnd);
    const content = normalizeContent(chapterRawContent);

    // Skip empty chunks
    if (content.length < 50 && validMatches.length > 1) {
      continue;
    }

    // Determine clean chapter title
    let title: string = "";
    if (current.titleStr) {
      title = current.titleStr.replace(/^#+\s*/, "").trim();
    }

    // If title was on the next line (common in markdown with ## Chapter Title right below ### CHAPTER 1)
    if (!title) {
      const nextLineMatch = chapterRawContent.match(/^###?[^\n]+\n+##?\s+([^\n]+)/);
      if (nextLineMatch) {
        title = nextLineMatch[1].trim();
      }
    }

    if (!title) {
      const num = current.numberStr ? ` ${current.numberStr}` : "";
      title = `${current.keyword}${num}`;
    }

    chapters.push({
      number: chapters.length + 1,
      title,
      content,
    });
  }

  return {
    title: defaultTitle,
    chapters,
  };
}

/**
 * Parses JSON book file if provided in structured format
 */
export function parseBookJson(jsonString: string): ParsedBook {
  const parsed = JSON.parse(jsonString);

  if (Array.isArray(parsed)) {
    return {
      chapters: parsed.map((item, idx) => ({
        number: Number(item.number ?? idx + 1),
        title: item.title ? String(item.title) : null,
        content: normalizeContent(String(item.content ?? "")),
      })),
    };
  }

  if (typeof parsed === "object" && parsed !== null && Array.isArray(parsed.chapters)) {
    return {
      title: parsed.title,
      author: parsed.author,
      description: parsed.description,
      chapters: parsed.chapters.map((item: any, idx: number) => ({
        number: Number(item.number ?? idx + 1),
        title: item.title ? String(item.title) : null,
        content: normalizeContent(String(item.content ?? "")),
      })),
    };
  }

  throw new Error("Invalid JSON book format: expected an array of chapters or an object with a chapters array");
}
