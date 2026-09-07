/**
 * Converts ranges inside ReaderContent paragraphs to UTF-16 offsets in the
 * canonical Chapter.content string. ReaderContent must render every canonical
 * paragraph as <p data-start="..."> without modifying its text nodes.
 */

export type CanonicalRange = {
  startPosition: number;
  endPosition: number;
};

export type CanonicalTextNodePosition = {
  node: Text;
  start: number;
  end: number;
};

function getTextLength(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.length ?? 0;
  }

  let length = 0;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode();

  while (textNode) {
    length += textNode.textContent?.length ?? 0;
    textNode = walker.nextNode();
  }

  return length;
}

function getParagraphForNode(node: Node) {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;

  return element?.closest<HTMLElement>("p[data-start]") ?? null;
}

function getOffsetWithinParagraph(
  container: Node,
  offset: number,
  paragraph: HTMLElement
) {
  let current: Node = container;
  let total = 0;

  if (container.nodeType === Node.TEXT_NODE) {
    total = offset;
  } else {
    const children = Array.from(container.childNodes);
    total = children
      .slice(0, offset)
      .reduce((length, child) => length + getTextLength(child), 0);
  }

  while (current !== paragraph) {
    const parent = current.parentNode;
    if (!parent) {
      throw new Error("Range boundary is outside the ReaderContent paragraph.");
    }

    const siblings = Array.from(parent.childNodes);
    const index = siblings.indexOf(current as ChildNode);
    total += siblings
      .slice(0, index)
      .reduce((length, sibling) => length + getTextLength(sibling), 0);
    current = parent;
  }

  return total;
}

function getBoundaryPosition(
  container: Node,
  offset: number,
  root: HTMLElement
) {
  if (!root.contains(container)) {
    throw new Error("Range boundary is outside the ReaderContent root.");
  }

  const paragraph = getParagraphForNode(container);
  if (!paragraph || !root.contains(paragraph)) {
    throw new Error("Range boundary is not inside a canonical paragraph.");
  }

  const paragraphStart = Number(paragraph.dataset.start);
  if (!Number.isInteger(paragraphStart)) {
    throw new Error("ReaderContent paragraph is missing a canonical data-start.");
  }

  return paragraphStart + getOffsetWithinParagraph(container, offset, paragraph);
}

/**
 * Builds the explicit DOM text node -> canonical UTF-16 range mapping.
 * The omitted ranges between paragraphs are the canonical "\n\n" separators.
 */
export function getCanonicalTextNodePositions(
  root: HTMLElement
): CanonicalTextNodePosition[] {
  const nodes: CanonicalTextNodePosition[] = [];
  const paragraphs = root.querySelectorAll<HTMLElement>("p[data-start]");

  for (const paragraph of paragraphs) {
    const paragraphStart = Number(paragraph.dataset.start);
    if (!Number.isInteger(paragraphStart)) continue;

    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    let localOffset = 0;
    let node = walker.nextNode() as Text | null;

    while (node) {
      const length = node.textContent?.length ?? 0;
      nodes.push({
        node,
        start: paragraphStart + localOffset,
        end: paragraphStart + localOffset + length,
      });
      localOffset += length;
      node = walker.nextNode() as Text | null;
    }
  }

  return nodes;
}

function getRangeBoundary(
  nodes: CanonicalTextNodePosition[],
  position: number,
  preferEnd: boolean
) {
  const candidate = preferEnd
    ? [...nodes].reverse().find((node) => position >= node.start && position <= node.end)
    : nodes.find((node) => position >= node.start && position <= node.end);

  if (candidate) {
    return {
      node: candidate.node,
      offset: position - candidate.start,
    };
  }

  const before = [...nodes]
    .reverse()
    .find((node) => node.end < position);
  const after = nodes.find((node) => node.start > position);

  if (!before && !after) {
    throw new Error("Canonical position does not map to ReaderContent text.");
  }

  // A canonical "\n\n" separator has no DOM text node. Keep the reconstructed
  // range in document order by snapping its start forward and its end backward.
  const fallback = preferEnd ? before ?? after : after ?? before;
  if (!fallback) {
    throw new Error("Canonical position does not map to ReaderContent text.");
  }

  return {
    node: fallback.node,
    offset: fallback === before ? fallback.end - fallback.start : 0,
  };
}

/**
 * Range.start/end are document-ordered by the DOM API, including when the
 * user selected backwards (right-to-left). Offsets are JavaScript UTF-16
 * indices and are intentionally not converted to code points or graphemes.
 */
export function domRangeToCanonicalOffsets(
  range: Range,
  root: HTMLElement
): CanonicalRange {
  const startPosition = getBoundaryPosition(
    range.startContainer,
    range.startOffset,
    root
  );
  const endPosition = getBoundaryPosition(
    range.endContainer,
    range.endOffset,
    root
  );

  if (startPosition > endPosition) {
    return { startPosition: endPosition, endPosition: startPosition };
  }

  return { startPosition, endPosition };
}

/**
 * Rebuilds a DOM Range from canonical UTF-16 offsets. Positions in the
 * paragraph separator (the canonical "\n\n") snap to the closest text-node
 * boundary; selections created from the DOM never originate in that gap.
 */
export function canonicalOffsetsToDomRange(
  root: HTMLElement,
  { startPosition, endPosition }: CanonicalRange,
  cachedNodes?: CanonicalTextNodePosition[]
) {
  if (startPosition < 0 || endPosition < startPosition) {
    throw new Error("Canonical range is invalid.");
  }

  const nodes = cachedNodes ?? getCanonicalTextNodePositions(root);
  const start = getRangeBoundary(nodes, startPosition, false);
  const end = getRangeBoundary(nodes, endPosition, true);
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}
