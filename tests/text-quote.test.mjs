import test from "node:test";
import assert from "node:assert/strict";

// Simple DOM Mock for TextQuote testing in Node environment
class MockTextNode {
  constructor(text) {
    this.nodeType = 3;
    this.nodeValue = text;
  }
  get length() {
    return this.nodeValue.length;
  }
}

class MockElement {
  constructor(tag, children = []) {
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.childNodes = children;
  }
  get firstChild() {
    return this.childNodes[0] || null;
  }
  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] || null;
  }
}

class MockRange {
  constructor(doc) {
    this.doc = doc;
    this.startContainer = null;
    this.startOffset = 0;
    this.endContainer = null;
    this.endOffset = 0;
  }
  setStart(node, offset) {
    this.startContainer = node;
    this.startOffset = offset;
  }
  setEnd(node, offset) {
    this.endContainer = node;
    this.endOffset = offset;
  }
  toString() {
    if (!this.startContainer || !this.endContainer) return "";
    if (this.startContainer === this.endContainer) {
      return this.startContainer.nodeValue.slice(this.startOffset, this.endOffset);
    }
    // Cross-node concatenation
    let text = this.startContainer.nodeValue.slice(this.startOffset);
    const nodes = this.doc.allTextNodes;
    const startIdx = nodes.indexOf(this.startContainer);
    const endIdx = nodes.indexOf(this.endContainer);
    for (let i = startIdx + 1; i < endIdx; i++) {
      text += nodes[i].nodeValue;
    }
    text += this.endContainer.nodeValue.slice(0, this.endOffset);
    return text;
  }
}

class MockDocument {
  constructor(paragraphs) {
    this.allTextNodes = [];
    const pElements = paragraphs.map((text) => {
      const tn = new MockTextNode(text);
      this.allTextNodes.push(tn);
      return new MockElement("p", [tn]);
    });
    this.body = new MockElement("body", pElements);
  }

  createTreeWalker() {
    let index = -1;
    const nodes = this.allTextNodes;
    return {
      nextNode() {
        index++;
        return index < nodes.length ? nodes[index] : null;
      },
    };
  }

  createRange() {
    return new MockRange(this);
  }
}

// Logic under test adapted for mock
function buildDocumentTextMap(doc) {
  const walker = doc.createTreeWalker();
  const map = [];
  let fullText = "";

  let current = walker.nextNode();
  while (current) {
    const textNode = current;
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

function offsetsToRange(doc, map, startOffset, endOffset) {
  let startNode = null;
  let startNodeOffset = 0;
  let endNode = null;
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

  const range = doc.createRange();
  range.setStart(startNode, startNodeOffset);
  range.setEnd(endNode, endNodeOffset);
  return range;
}

function findRangeByTextQuote(doc, quote) {
  if (!doc.body || !quote.exact) return null;

  const { fullText, map } = buildDocumentTextMap(doc);
  if (!fullText) return null;

  const exact = quote.exact;
  const prefix = quote.prefix ?? "";
  const suffix = quote.suffix ?? "";

  let searchIdx = fullText.indexOf(exact);
  if (searchIdx === -1) return null;

  const matches = [];
  while (searchIdx !== -1) {
    matches.push(searchIdx);
    searchIdx = fullText.indexOf(exact, searchIdx + exact.length);
  }

  if (matches.length === 1) {
    return offsetsToRange(doc, map, matches[0], matches[0] + exact.length);
  }

  let bestIdx = matches[0];
  let bestScore = -1;

  for (const idx of matches) {
    let score = 0;
    if (prefix) {
      const textPre = fullText.slice(Math.max(0, idx - prefix.length), idx);
      if (textPre === prefix) score += 10;
      else if (textPre.endsWith(prefix.slice(-20))) score += 5;
    }
    if (suffix) {
      const textPost = fullText.slice(idx + exact.length, idx + exact.length + suffix.length);
      if (textPost === suffix) score += 10;
      else if (textPost.startsWith(suffix.slice(0, 20))) score += 5;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  return offsetsToRange(doc, map, bestIdx, bestIdx + exact.length);
}

test("findRangeByTextQuote finds unique exact match in document", () => {
  const doc = new MockDocument([
    "Это первая вступительная глава.",
    "Здесь находится ключевой алгоритм продуктивности для читателя.",
    "И заключение первой главы.",
  ]);

  const range = findRangeByTextQuote(doc, {
    exact: "ключевой алгоритм продуктивности",
    prefix: "Здесь находится ",
    suffix: " для читателя.",
  });

  assert.ok(range);
  assert.equal(range.toString(), "ключевой алгоритм продуктивности");
});

test("findRangeByTextQuote disambiguates multiple occurrences using prefix and suffix", () => {
  const doc = new MockDocument([
    "Мысль повторяется: чтение это пища для ума.",
    "Промежуточный абзац с рассуждениями о привычках.",
    "Второе напоминание: чтение это пища для ума в конце дня.",
  ]);

  const quoteTarget = {
    exact: "чтение это пища для ума",
    prefix: "Второе напоминание: ",
    suffix: " в конце дня.",
  };

  const range = findRangeByTextQuote(doc, quoteTarget);

  assert.ok(range);
  assert.equal(range.toString(), "чтение это пища для ума");
  assert.equal(range.startContainer.nodeValue, "Второе напоминание: чтение это пища для ума в конце дня.");
});

test("findRangeByTextQuote returns null when text does not exist", () => {
  const doc = new MockDocument(["Обычный текст без искомой фразы."]);
  const range = findRangeByTextQuote(doc, { exact: "несуществующая фраза" });
  assert.equal(range, null);
});
