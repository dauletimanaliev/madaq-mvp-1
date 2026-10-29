/**
 * W3C Web Annotation TextQuoteSelector extractor and matcher for EPUB sections.
 * Extracts prefix/suffix across the entire section DOM, and finds DOM Ranges
 * as a fallback if EPUB CFI becomes stale or invalid.
 */

export interface TextQuote {
  exact: string;
  prefix: string;
  suffix: string;
}

/**
 * Extracts exact text, prefix, and suffix across the entire section document.
 */
export function extractTextQuote(doc: Document, range: Range, contextLength = 60): TextQuote {
  const exact = range.toString().trim();

  let prefix = "";
  let suffix = "";

  try {
    // Prefix: text from the start of body up to the selection start
    const preRange = doc.createRange();
    if (doc.body) {
      preRange.selectNodeContents(doc.body);
      preRange.setEnd(range.startContainer, range.startOffset);
      const preText = preRange.toString().replace(/\s+/g, " ");
      prefix = preText.slice(-contextLength);
    }
  } catch (e) {
    console.warn("Failed to extract full prefix, falling back to local text", e);
  }

  try {
    // Suffix: text from the selection end to the end of body
    const postRange = doc.createRange();
    if (doc.body) {
      postRange.selectNodeContents(doc.body);
      postRange.setStart(range.endContainer, range.endOffset);
      const postText = postRange.toString().replace(/\s+/g, " ");
      suffix = postText.slice(0, contextLength);
    }
  } catch (e) {
    console.warn("Failed to extract full suffix, falling back to local text", e);
  }

  return {
    exact,
    prefix,
    suffix,
  };
}

interface TextMapEntry {
  node: Text;
  start: number;
  end: number;
}

/**
 * Builds a continuous string of all text nodes in doc.body along with their offsets.
 */
function buildDocumentTextMap(doc: Document): { fullText: string; map: TextMapEntry[] } {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const map: TextMapEntry[] = [];
  let fullText = "";

  let current: Node | null = walker.nextNode();
  while (current) {
    const textNode = current as Text;
    const len = textNode.nodeValue?.length ?? 0;
    if (len > 0) {
      map.push({
        node: textNode,
        start: fullText.length,
        end: fullText.length + len,
      });
      fullText += textNode.nodeValue;
    }
    current = walker.nextNode();
  }

  return { fullText, map };
}

/**
 * Maps character offsets [startOffset, endOffset] in fullText back to a DOM Range.
 */
function offsetsToRange(doc: Document, map: TextMapEntry[], startOffset: number, endOffset: number): Range | null {
  let startNode: Text | null = null;
  let startNodeOffset = 0;
  let endNode: Text | null = null;
  let endNodeOffset = 0;

  for (const entry of map) {
    if (!startNode && startOffset >= entry.start && startOffset <= entry.end) {
      startNode = entry.node;
      startNodeOffset = startOffset - entry.start;
    }
    if (endOffset >= entry.start && endOffset <= entry.end) {
      endNode = entry.node;
      endNodeOffset = endOffset - entry.start;
      break;
    }
  }

  if (!startNode || !endNode) return null;

  try {
    const range = doc.createRange();
    range.setStart(startNode, Math.min(startNodeOffset, startNode.nodeValue?.length ?? 0));
    range.setEnd(endNode, Math.min(endNodeOffset, endNode.nodeValue?.length ?? 0));
    return range;
  } catch (e) {
    console.warn("offsetsToRange failed:", e);
    return null;
  }
}

/**
 * Searches for a text quote in the document with prefix/suffix disambiguation.
 * Returns a valid DOM Range if found, or null.
 */
export function findRangeByTextQuote(
  doc: Document,
  quote: { exact: string; prefix?: string | null; suffix?: string | null }
): Range | null {
  if (!doc.body || !quote.exact) return null;

  const { fullText, map } = buildDocumentTextMap(doc);
  if (!fullText) return null;

  const exact = quote.exact;
  const prefix = quote.prefix ?? "";
  const suffix = quote.suffix ?? "";

  // Normalize target string (collapse internal whitespace for fuzzy search if needed)
  let searchIdx = fullText.indexOf(exact);
  if (searchIdx === -1) {
    // Try whitespace-normalized match
    const normExact = exact.replace(/\s+/g, " ");
    const normFull = fullText.replace(/\s+/g, " ");
    const normIdx = normFull.indexOf(normExact);
    if (normIdx === -1) return null;
    // If found in normalized text, search with regex that allows variable whitespace
    const escaped = exact.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const regex = new RegExp(escaped, "g");
    const matches: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(fullText)) !== null) {
      matches.push(m);
    }
    if (matches.length === 0) return null;
    if (matches.length === 1) {
      return offsetsToRange(doc, map, matches[0].index, matches[0].index + matches[0][0].length);
    }
    // Disambiguate multiple regex matches
    let bestMatch = matches[0];
    let bestScore = -1;
    for (const match of matches) {
      let score = 0;
      if (prefix) {
        const textPre = fullText.slice(Math.max(0, match.index - prefix.length), match.index);
        if (textPre.includes(prefix.slice(-15))) score += 2;
      }
      if (suffix) {
        const textPost = fullText.slice(match.index + match[0].length, match.index + match[0].length + suffix.length);
        if (textPost.includes(suffix.slice(0, 15))) score += 2;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = match;
      }
    }
    return offsetsToRange(doc, map, bestMatch.index, bestMatch.index + bestMatch[0].length);
  }

  // Exact match found! Check if there are multiple occurrences
  const matches: number[] = [];
  while (searchIdx !== -1) {
    matches.push(searchIdx);
    searchIdx = fullText.indexOf(exact, searchIdx + exact.length);
  }

  if (matches.length === 1) {
    return offsetsToRange(doc, map, matches[0], matches[0] + exact.length);
  }

  // Multiple occurrences: pick best match using prefix and suffix
  let bestIdx = matches[0];
  let bestScore = -1;

  for (const idx of matches) {
    let score = 0;
    if (prefix) {
      const textPre = fullText.slice(Math.max(0, idx - prefix.length), idx);
      if (textPre === prefix) score += 10;
      else if (textPre.endsWith(prefix.slice(-20))) score += 5;
      else if (textPre.includes(prefix.slice(-10))) score += 2;
    }
    if (suffix) {
      const textPost = fullText.slice(idx + exact.length, idx + exact.length + suffix.length);
      if (textPost === suffix) score += 10;
      else if (textPost.startsWith(suffix.slice(0, 20))) score += 5;
      else if (textPost.includes(suffix.slice(0, 10))) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  return offsetsToRange(doc, map, bestIdx, bestIdx + exact.length);
}
