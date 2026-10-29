import type { HighlightType } from "@/lib/types";

export type ReaderTheme = "paper" | "sepia" | "dark";

export interface CategoryColorConfig {
  name: string;
  shortLabel: string;
  description: string;
  colorName: string;
  paperRgba: string;
  sepiaRgba: string;
  darkRgba: string;
  badgeClass: string;
  dotClass: string;
}

export const EPUB_HIGHLIGHT_PALETTE: Record<HighlightType | "none", CategoryColorConfig> = {
  protein: {
    name: "Белки",
    shortLabel: "Б",
    colorName: "Красный",
    description: "Приёмы, лайфхаки, алгоритмы, которые можно сразу внедрить",
    paperRgba: "rgba(239, 68, 68, 0.32)",
    sepiaRgba: "rgba(239, 68, 68, 0.32)",
    darkRgba: "rgba(248, 113, 113, 0.32)",
    badgeClass: "bg-red-100 text-red-800 border-red-300",
    dotClass: "bg-red-500 hover:bg-red-600 ring-red-400",
  },
  carbohydrate: {
    name: "Углеводы",
    shortLabel: "У",
    colorName: "Оранжевый",
    description: "Энергия и мотивация, мысли, которые вдохновляют или дают новый угол",
    paperRgba: "rgba(234, 88, 12, 0.30)",
    sepiaRgba: "rgba(234, 88, 12, 0.30)",
    darkRgba: "rgba(251, 146, 60, 0.32)",
    badgeClass: "bg-orange-100 text-orange-900 border-orange-300",
    dotClass: "bg-orange-500 hover:bg-orange-600 ring-orange-400",
  },
  fat: {
    name: "Жиры",
    shortLabel: "Ж",
    colorName: "Жёлтый",
    description: "Истории, кейсы, контекст, интригующие детали",
    paperRgba: "rgba(234, 179, 8, 0.35)",
    sepiaRgba: "rgba(234, 179, 8, 0.35)",
    darkRgba: "rgba(254, 240, 138, 0.28)",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
    dotClass: "bg-yellow-400 hover:bg-yellow-500 ring-yellow-400",
  },
  vitamin: {
    name: "Витамины",
    shortLabel: "В",
    colorName: "Зелёный",
    description: "Афоризмы, остроумные цитаты, курьёзы",
    paperRgba: "rgba(16, 185, 129, 0.28)",
    sepiaRgba: "rgba(16, 185, 129, 0.28)",
    darkRgba: "rgba(52, 211, 153, 0.30)",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    dotClass: "bg-emerald-500 hover:bg-emerald-600 ring-emerald-400",
  },
  fiber: {
    name: "Клетчатка",
    shortLabel: "К",
    colorName: "Синий",
    description: "Цифры, статистика, хронология, имена, ссылки на исследования",
    paperRgba: "rgba(14, 165, 233, 0.28)",
    sepiaRgba: "rgba(14, 165, 233, 0.28)",
    darkRgba: "rgba(56, 189, 248, 0.30)",
    badgeClass: "bg-sky-100 text-sky-800 border-sky-300",
    dotClass: "bg-sky-500 hover:bg-sky-600 ring-sky-400",
  },
  none: {
    name: "Без категории",
    shortLabel: "—",
    colorName: "Серый",
    description: "Быстрое выделение для разбора позже в /notes",
    paperRgba: "rgba(120, 113, 108, 0.22)",
    sepiaRgba: "rgba(120, 113, 108, 0.22)",
    darkRgba: "rgba(168, 162, 158, 0.28)",
    badgeClass: "bg-stone-100 text-stone-800 border-stone-300",
    dotClass: "bg-stone-400 hover:bg-stone-500 ring-stone-400",
  },
};

export function getHighlightRgba(type: HighlightType | null | undefined, theme: ReaderTheme): string {
  const catKey = (type && type in EPUB_HIGHLIGHT_PALETTE) ? type : "none";
  const conf = EPUB_HIGHLIGHT_PALETTE[catKey];
  switch (theme) {
    case "dark":
      return conf.darkRgba;
    case "sepia":
      return conf.sepiaRgba;
    case "paper":
    default:
      return conf.paperRgba;
  }
}

/**
 * Creates SVG highlight elements conforming to foliate-js Overlayer contract.
 */
export function drawEpubHighlight(
  rects: DOMRectList | DOMRect[],
  options: { type?: HighlightType | null; theme?: ReaderTheme; highlightId?: string }
): SVGElement {
  const theme = options.theme || "paper";
  const fillRgba = getHighlightRgba(options.type, theme);

  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("class", "madaq-epub-highlight");
  if (options.highlightId) {
    g.setAttribute("data-highlight-id", options.highlightId);
  }
  g.style.cursor = "pointer";

  for (const r of Array.from(rects)) {
    if (r.width <= 0 || r.height <= 0) continue;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(r.left));
    rect.setAttribute("y", String(r.top));
    rect.setAttribute("width", String(r.width));
    rect.setAttribute("height", String(r.height));
    rect.setAttribute("rx", "2");
    rect.setAttribute("ry", "2");
    rect.setAttribute("fill", fillRgba);
    g.append(rect);
  }

  return g;
}
