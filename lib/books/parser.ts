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
 *   # Глава 1: Название
 *   ## Chapter 2
 *   Глава 3. Встреча
 *   ГЛАВА 4
 */
export function parseBookText(rawText: string, defaultTitle?: string): ParsedBook {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  // Pattern for chapter headings:
  // Starts with line start or newline, optional markdown header (#, ##, ###),
  // followed by "Глава", "Chapter", "ЧАСТЬ", etc., and chapter number/title
  const chapterRegex =
    /(?:^|\n)(?:#{1,3}\s+)?(?:Глава|ГЛАВА|глава|Chapter|CHAPTER|Часть|ЧАСТЬ)\s+([0-9IVXLCDM]+|[а-яёА-ЯЁ\w]+)?(?::|\.|\s-|\s—)?\s*([^\n]*)/g;

  const matches: { index: number; length: number; numberStr: string; titleStr: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = chapterRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      numberStr: (match[1] || "").trim(),
      titleStr: (match[2] || "").trim(),
    });
  }

  // If no explicit chapter headers found, try splitting by top-level Markdown headers `# `
  if (matches.length < 2) {
    const mdHeaderRegex = /(?:^|\n)#{1,2}\s+([^\n]+)/g;
    matches.length = 0;
    while ((match = mdHeaderRegex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
        numberStr: "",
        titleStr: (match[1] || "").trim(),
      });
    }
  }

  // If still fewer than 2 chapters found, treat entire text as a single chapter
  if (matches.length === 0) {
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

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    const contentStart = current.index + current.length;
    const contentEnd = next ? next.index : text.length;
    const chapterRawContent = text.slice(contentStart, contentEnd);
    const content = normalizeContent(chapterRawContent);

    // If there is no content in this chapter (e.g. title-only prefix), skip unless it's the only one
    if (!content && matches.length > 1) {
      continue;
    }

    const chapterNumber = i + 1;
    let title: string | null = current.titleStr || null;
    if (title && title.startsWith("#")) {
      title = title.replace(/^#+\s*/, "").trim();
    }

    chapters.push({
      number: chapterNumber,
      title: title || `Глава ${chapterNumber}`,
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
    // Array of chapters: [{ number, title, content }]
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
