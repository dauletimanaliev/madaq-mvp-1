"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
} from "react";
import type { EpubTheme, EpubTocItem, EpubViewportHandle } from "./types";
import {
  fetchEpubHighlights,
  saveEpubHighlight,
  updateEpubHighlightCategory,
  removeEpubHighlight,
  repairEpubHighlightCfi,
} from "@/app/books/[bookId]/epub/actions";
import { EpubHighlightPopover, type PopoverPosition } from "./EpubHighlightPopover";
import { drawEpubHighlight } from "@/lib/epub/highlight-styles";
import { extractTextQuote, findRangeByTextQuote } from "@/lib/epub/text-quote";
import type { Highlight, HighlightType } from "@/lib/types";

interface EpubViewportProps {
  bookId: string;
  theme: EpubTheme;
  fontSize: number;
  isMobile?: boolean;
  onTocLoaded: (items: EpubTocItem[]) => void;
  onRelocate: (label: string | null) => void;
  /** Reading position in stable "pages" of ~1500 characters (independent of font size). */
  onProgress?: (page: number, total: number) => void;
}

export const themePalettes: Record<
  EpubTheme,
  { bg: string; text: string; link: string; selection: string; border: string }
> = {
  paper: {
    bg: "#ffffff",
    text: "#1c1917",
    link: "#7a2e3a",
    selection: "rgba(180, 83, 9, 0.22)",
    border: "rgba(28, 25, 23, 0.15)",
  },
  sepia: {
    bg: "#f4ecd8",
    text: "#382a18",
    link: "#6d281a",
    selection: "rgba(109, 40, 26, 0.22)",
    border: "rgba(56, 42, 24, 0.18)",
  },
  dark: {
    bg: "#18181b",
    text: "#e4e4e7",
    link: "#e09f67",
    selection: "rgba(224, 159, 103, 0.3)",
    border: "rgba(228, 228, 231, 0.18)",
  },
};

export function detectBookLanguage(book?: { metadata?: { language?: string | string[] } } | null): "ru" | "en" | "kk" {
  try {
    const raw = book?.metadata?.language;
    const lang = (Array.isArray(raw) ? raw[0] : raw) || "";
    const lower = String(lang).toLowerCase();
    if (lower.startsWith("kk") || lower.startsWith("kz")) return "kk";
    if (lower.startsWith("en")) return "en";
    if (lower.startsWith("ru")) return "ru";
  } catch {}
  return "ru";
}

export function generateEpubStyles(
  theme: EpubTheme,
  fontSize: number,
  lang: "ru" | "en" | "kk" = "ru",
  origin: string = "",
  isNarrow: boolean = false
): string {
  const palette = themePalettes[theme] || themePalettes.paper;
  const isKazakh = lang === "kk";
  const pTextAlign = (isKazakh && isNarrow) ? "left" : "justify";
  const pTextJustify = (isKazakh && isNarrow) ? "auto" : "inter-word";

  return `
    @font-face {
      font-family: 'Literata';
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url('${origin}/fonts/literata-regular.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Literata';
      font-style: italic;
      font-weight: 400;
      font-display: swap;
      src: url('${origin}/fonts/literata-italic.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Literata';
      font-style: normal;
      font-weight: 600;
      font-display: swap;
      src: url('${origin}/fonts/literata-bold.woff2') format('woff2');
    }
    @font-face {
      font-family: 'Literata';
      font-style: normal;
      font-weight: 700;
      font-display: swap;
      src: url('${origin}/fonts/literata-bold.woff2') format('woff2');
    }

    html {
      color-scheme: ${theme === "dark" ? "dark" : "light"};
      background-color: ${palette.bg} !important;
      color: ${palette.text} !important;
    }

    body {
      background-color: ${palette.bg} !important;
      color: ${palette.text} !important;
      font-family: 'Literata', Georgia, 'Times New Roman', serif !important;
      font-size: ${fontSize}% !important;
      line-height: 1.58 !important;
      letter-spacing: -0.003em;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Universal normalization: reset text colors, fonts and clear arbitrary backgrounds */
    p, span, div, li, td, th, blockquote, em, strong, b, i, u, s, small, mark, dt, dd, section, article, header, footer, aside, main {
      color: ${palette.text} !important;
      font-family: 'Literata', Georgia, 'Times New Roman', serif !important;
      background-color: transparent !important;
      background: transparent !important;
      letter-spacing: -0.003em !important;
    }

    /* Containers must not arbitrarily alter column width, indent or font-size */
    div, section, article, main, header, footer, aside {
      margin-left: 0 !important;
      margin-right: 0 !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
      border: none !important;
      background: transparent !important;
      background-color: transparent !important;
      box-shadow: none !important;
      font-size: 1rem !important;
    }

    /* Inline text formatting inherits 1rem font-size */
    span, em, strong, b, i, u, s, small, mark {
      font-size: inherit !important;
      line-height: inherit !important;
      background: transparent !important;
      background-color: transparent !important;
      color: inherit !important;
    }

    /* Paragraph indentation & uniform rhythm */
    p {
      margin-top: 0 !important;
      margin-bottom: 0 !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
      padding: 0 !important;
      font-size: 1rem !important;
      line-height: 1.58 !important;
      text-indent: 0 !important;
      text-align: ${pTextAlign} !important;
      text-justify: ${pTextJustify} !important;
      hyphens: ${isKazakh ? "none" : "auto"} !important;
      -webkit-hyphens: ${isKazakh ? "none" : "auto"} !important;
      color: ${palette.text} !important;
      background: transparent !important;
      background-color: transparent !important;
    }

    /* Red line indent on subsequent paragraphs */
    p + p {
      text-indent: 1.5em !important;
    }

    /* No indent on first paragraph after headings, dividers, blockquotes */
    h1 + p, h2 + p, h3 + p, h4 + p, h5 + p, h6 + p,
    .title + p, .chapter-title + p, .subtitle + p,
    hr + p, blockquote + p, div > p:first-of-type,
    section > p:first-of-type, article > p:first-of-type,
    header + p, nav + p {
      text-indent: 0 !important;
    }

    /* Headings: font-weight 600, ~1.1em, letter-spacing 0.06em */
    h1, h2, h3, h4, h5, h6, .chapter-title, .title, .header {
      font-family: 'Literata', Georgia, 'Times New Roman', serif !important;
      text-transform: uppercase !important;
      letter-spacing: 0.06em !important;
      font-weight: 600 !important;
      font-size: 1.1em !important;
      line-height: 1.35 !important;
      margin-top: 1.6em !important;
      margin-bottom: 1.1em !important;
      text-align: left !important;
      color: ${palette.text} !important;
      background: transparent !important;
      background-color: transparent !important;
    }

    h1 {
      font-size: 1.15em !important;
    }

    h2 {
      font-size: 1.1em !important;
    }

    /* Kazakh language on narrow screens: left alignment */
    ${
      isNarrow
        ? `
    :lang(kk), :lang(kk) p, [lang*="kk"] p, p[lang*="kk"], [xml\\:lang*="kk"] p, html[lang*="kk"] p, body[lang*="kk"] p, :root[lang="kk"] p, body[lang="kk"] p, [lang="kk"] p, p[lang="kk"] {
      text-align: left !important;
      text-justify: auto !important;
      hyphens: none !important;
      -webkit-hyphens: none !important;
    }
    `
        : `
    :lang(kk), :lang(kk) p, [lang*="kk"] p, p[lang*="kk"], [xml\\:lang*="kk"] p, html[lang*="kk"] p, body[lang*="kk"] p, :root[lang="kk"] p, body[lang="kk"] p, [lang="kk"] p, p[lang="kk"] {
      text-align: justify !important;
      text-justify: inter-word !important;
      hyphens: none !important;
      -webkit-hyphens: none !important;
    }
    `
    }

    @media (max-width: 600px) {
      h1, h2, h3, h4, h5, h6, .chapter-title, .title, .header {
        font-size: 1.0em !important;
        letter-spacing: 0.04em !important;
        margin-top: 1.3em !important;
        margin-bottom: 0.85em !important;
      }
    }

    /* Text selection */
    ::selection {
      background: ${palette.selection} !important;
    }

    /* Links */
    a {
      color: ${palette.link} !important;
      text-decoration: underline !important;
      text-underline-offset: 2px;
      background: transparent !important;
    }

    /* Blockquotes */
    blockquote {
      margin: 1.25em 1.5em !important;
      padding-left: 1.1em !important;
      border-left: 2.5px solid ${palette.link} !important;
      font-style: italic !important;
      opacity: 0.9;
      background: transparent !important;
    }

    /* Code and pre */
    pre, code, kbd, samp {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
      font-size: 0.88em !important;
      text-indent: 0 !important;
      white-space: pre-wrap !important;
      background: ${theme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)"} !important;
      border-radius: 4px;
      padding: 0.15em 0.35em !important;
      color: ${palette.text} !important;
    }

    pre code {
      padding: 0 !important;
      background: transparent !important;
    }

    /* Images and media protection */
    img, svg, picture, video, canvas, audio {
      max-width: 100% !important;
      height: auto !important;
      display: block;
      margin: 1.5em auto !important;
    }

    /* Table styling & neutral borders */
    table {
      border-collapse: collapse !important;
      border: 1px solid ${palette.border} !important;
      width: 100% !important;
      margin: 1.5em auto !important;
      text-indent: 0 !important;
      background-color: transparent !important;
    }

    th, td {
      border: 1px solid ${palette.border} !important;
      padding: 0.45em 0.8em !important;
      color: ${palette.text} !important;
      background-color: transparent !important;
      font-size: 0.95rem !important;
    }

    th {
      font-weight: 600 !important;
    }

    /* Lists */
    ul, ol {
      margin: 0.8em 0 !important;
      padding-left: 1.8em !important;
      text-indent: 0 !important;
    }

    li {
      margin-bottom: 0.3em !important;
      text-indent: 0 !important;
    }
  `;
}

interface FoliateViewElement extends HTMLElement {
  open: (data: unknown) => Promise<void>;
  init: (options: { lastLocation?: string | null; showTextStart?: boolean }) => Promise<void>;
  close?: () => void;
  goTo: (href: string) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  getCFI: (index: number, range?: Range) => string;
  resolveCFI: (cfi: string) => { index: number; anchor: (doc?: Document) => Range | null } | null;
  addAnnotation: (annotation: { value: string; [key: string]: unknown }, remove?: boolean) => Promise<{ index: number; label: string } | undefined>;
  deleteAnnotation: (annotation: { value: string; [key: string]: unknown }) => Promise<unknown>;
  book?: {
    sections?: { href: string; cfi?: string }[];
    metadata?: {
      language?: string | string[];
      title?: string;
    };
    toc?: EpubTocItem[];
  };
  renderer?: {
    setAttribute: (name: string, value: string) => void;
    setStyles: (styles: string) => void;
    getContents?: () => Array<{
      index: number;
      doc?: Document;
      overlayer?: {
        add: (key: string, range: Range, draw: (rects: DOMRect[]) => SVGElement, options?: unknown) => void;
        remove: (key: string) => void;
        redraw: () => void;
      };
    }>;
  };
}

export const EpubViewport = forwardRef<EpubViewportHandle, EpubViewportProps>(
  function EpubViewport(
    { bookId, theme, fontSize, isMobile, onTocLoaded, onRelocate, onProgress },
    ref
  ) {
    // Kept in a ref so a new callback does not re-open the book.
    const onProgressRef = useRef(onProgress);
    useEffect(() => {
      onProgressRef.current = onProgress;
    }, [onProgress]);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<FoliateViewElement | null>(null);
    const bookLangRef = useRef<"ru" | "en" | "kk">("ru");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const highlightsRef = useRef<Highlight[]>([]);
    highlightsRef.current = highlights;

    const themeRef = useRef(theme);
    themeRef.current = theme;

    const [popoverState, setPopoverState] = useState<{
      position: PopoverPosition;
      range: Range;
      cfi: string;
      selectedText: string;
      sectionHref?: string | null;
      sectionIndex?: number | null;
      doc: Document;
      existingHighlight?: Highlight | null;
    } | null>(null);

    const [toast, setToast] = useState<{ message: string; onRetry?: () => void } | null>(null);

    const palette = themePalettes[theme] || themePalettes.paper;


    useImperativeHandle(
      ref,
      () => ({
        goTo: (href: string) => {
          if (viewRef.current?.goTo) {
            setIsLoading(false);
            viewRef.current.goTo(href).catch((err: unknown) => {
              console.error("Failed to navigate to", href, err);
            });
          }
        },
        next: () => {
          if (viewRef.current?.next) {
            viewRef.current.next().catch((err: unknown) => {
              console.error("Failed to go to next page", err);
            });
          }
        },
        prev: () => {
          if (viewRef.current?.prev) {
            viewRef.current.prev().catch((err: unknown) => {
              console.error("Failed to go to prev page", err);
            });
          }
        },
      }),
      []
    );

    const checkIsNarrow = useCallback(() => {
      if (isMobile) return true;
      if (typeof window === "undefined") return false;
      if (process.env.NODE_ENV !== "production") {
        try {
          const params = new URLSearchParams(window.location.search);
          if (params.get("w") === "390" || params.get("mobile") === "1") return true;
        } catch {}
      }
      const width = containerRef.current?.clientWidth || window.innerWidth;
      return width <= 600;
    }, [isMobile]);

    const getAllDocuments = useCallback((): Document[] => {
      const docs: Document[] = [];
      try {
        const contents = (viewRef.current as unknown as { renderer?: { getContents?: () => Array<{ doc?: Document }> } })?.renderer?.getContents?.();
        if (Array.isArray(contents)) {
          for (const item of contents) {
            if (item?.doc && !docs.includes(item.doc)) docs.push(item.doc);
          }
        }
        const shadow = (viewRef.current as unknown as { renderer?: { shadowRoot?: ShadowRoot } })?.renderer?.shadowRoot;
        if (shadow) {
          const iframes = shadow.querySelectorAll("iframe");
          iframes.forEach((iframe: HTMLIFrameElement) => {
            if (iframe.contentDocument && !docs.includes(iframe.contentDocument)) {
              docs.push(iframe.contentDocument);
            }
          });
        }
      } catch {}
      return docs;
    }, []);

    const applyKazakhAlignment = useCallback((doc: Document, isNarrow: boolean) => {
      try {
        const text = doc.body?.textContent || "";
        const docLang = doc.documentElement?.getAttribute("lang") || "";
        const isKk = /[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/.test(text) || docLang.startsWith("kk") || bookLangRef.current === "kk";
        if (!isKk) return;

        doc.documentElement.setAttribute("lang", "kk");
        doc.documentElement.setAttribute("xml:lang", "kk");
        if (doc.body) {
          doc.body.setAttribute("lang", "kk");
          doc.body.setAttribute("xml:lang", "kk");
        }

        if (doc.head) {
          let styleEl = doc.getElementById("madaq-align-override") as HTMLStyleElement | null;
          if (!styleEl) {
            styleEl = doc.createElement("style");
            styleEl.id = "madaq-align-override";
            doc.head.appendChild(styleEl);
          }
          styleEl.textContent = isNarrow
            ? "p, div, span, body, :root { text-align: left !important; text-justify: auto !important; hyphens: none !important; -webkit-hyphens: none !important; }"
            : "p, div, span, body, :root { text-align: justify !important; text-justify: inter-word !important; hyphens: none !important; -webkit-hyphens: none !important; }";
        }

        doc.querySelectorAll("p").forEach((p) => {
          p.setAttribute("lang", "kk");
          if (isNarrow) {
            p.style.setProperty("text-align", "left", "important");
            p.style.setProperty("text-justify", "auto", "important");
            p.style.setProperty("hyphens", "none", "important");
            p.style.setProperty("-webkit-hyphens", "none", "important");
          } else {
            p.style.setProperty("text-align", "justify", "important");
            p.style.setProperty("text-justify", "inter-word", "important");
            p.style.setProperty("hyphens", "none", "important");
            p.style.setProperty("-webkit-hyphens", "none", "important");
          }
        });
      } catch {}
    }, []);

    // Apply paginator attributes (line length, margins, gap, columns)
    const applyPaginatorAttributes = useCallback((view: FoliateViewElement | null) => {
      if (!view?.renderer) return;
      const isNarrow = checkIsNarrow();
      const maxInline = isNarrow ? "100%" : "680px";
      const margin = isNarrow ? "20px" : "36px";
      const gap = isNarrow ? "4%" : "6%";

      view.renderer.setAttribute("max-inline-size", maxInline);
      view.renderer.setAttribute("margin", margin);
      view.renderer.setAttribute("gap", gap);
      view.renderer.setAttribute("max-column-count", "1");
    }, [checkIsNarrow]);

    // Dynamically update styles when theme or fontSize changes
    useEffect(() => {
      if (viewRef.current?.renderer?.setStyles) {
        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        const isNarrow = checkIsNarrow();
        const styles = generateEpubStyles(
          theme,
          fontSize,
          bookLangRef.current,
          origin,
          isNarrow
        );
        viewRef.current.renderer.setStyles(styles);
        const docs = getAllDocuments();
        docs.forEach((doc) => applyKazakhAlignment(doc, isNarrow));

        // Redraw overlayer highlights with the updated theme colors
        try {
          viewRef.current.renderer.getContents?.()?.forEach((c) => {
            c.overlayer?.redraw?.();
          });
        } catch {}
      }
    }, [theme, fontSize, checkIsNarrow, getAllDocuments, applyKazakhAlignment]);

    const renderHighlightsForSection = useCallback(async (index: number) => {
      const view = viewRef.current;
      if (!view) return;
      const contents = view.renderer?.getContents?.();
      const contentObj = contents?.find((c) => c.index === index);
      const doc = contentObj?.doc;

      for (const h of highlightsRef.current) {
        if (!h.cfi) continue;
        if (h.sectionIndex != null && h.sectionIndex !== index) continue;

        let rendered = false;
        try {
          const resolved = view.resolveCFI(h.cfi);
          if (resolved && resolved.index === index) {
            await view.addAnnotation({
              value: h.cfi,
              type: h.type,
              highlightId: h.id,
            });
            rendered = true;
          }
        } catch {
          // CFI resolution failed
        }

        // Fallback: Text-Quote matching if not rendered via CFI
        if (!rendered && doc && h.selectedText) {
          const fallbackRange = findRangeByTextQuote(doc, {
            exact: h.selectedText,
            prefix: h.textQuotePrefix,
            suffix: h.textQuoteSuffix,
          });

          if (fallbackRange) {
            try {
              const newCfi = view.getCFI(index, fallbackRange);
              if (newCfi) {
                h.cfi = newCfi;
                await view.addAnnotation({
                  value: newCfi,
                  type: h.type,
                  highlightId: h.id,
                });
                void repairEpubHighlightCfi(h.id, newCfi);
              }
            } catch (e) {
              console.warn("Failed to repair CFI via text-quote", e);
            }
          }
        }
      }
    }, []);

    useEffect(() => {
      let active = true;
      fetchEpubHighlights(bookId).then((data: Highlight[]) => {
        if (active) {
          highlightsRef.current = data;
          setHighlights(data);
          try {
            viewRef.current?.renderer?.getContents?.()?.forEach((c) => {
              void renderHighlightsForSection(c.index);
            });
          } catch {}
        }
      });
      return () => {
        active = false;
      };
    }, [bookId, renderHighlightsForSection]);

    const handleSelectCategory = (type: HighlightType | null, note?: string) => {
      if (!popoverState) return;

      const currentState = popoverState;
      // Close popover and clear selection immediately for instant user feedback
      try {
        currentState.doc.getSelection()?.removeAllRanges();
      } catch {}
      setPopoverState(null);

      if (currentState.existingHighlight) {
        const id = currentState.existingHighlight.id;
        const prevHighlight = currentState.existingHighlight;
        // Optimistically update highlight state
        const updatedOptimistic: Highlight = {
          ...prevHighlight,
          type,
          note: note !== undefined ? note : prevHighlight.note,
        };
        highlightsRef.current = highlightsRef.current.map((h) =>
          h.id === id ? updatedOptimistic : h
        );
        setHighlights(highlightsRef.current);
        viewRef.current?.renderer?.getContents?.()?.forEach((c) => {
          c.overlayer?.redraw?.();
        });

        // Background server call
        updateEpubHighlightCategory(id, type, note)
          .then((res) => {
            if (res.ok) {
              highlightsRef.current = highlightsRef.current.map((h) =>
                h.id === id ? res.highlight : h
              );
              setHighlights(highlightsRef.current);
            } else {
              // Rollback on server error
              highlightsRef.current = highlightsRef.current.map((h) =>
                h.id === id ? prevHighlight : h
              );
              setHighlights(highlightsRef.current);
              viewRef.current?.renderer?.getContents?.()?.forEach((c) => {
                c.overlayer?.redraw?.();
              });
              setToast({
                message: "Не удалось обновить категорию выделения.",
                onRetry: () => handleSelectCategory(type, note),
              });
            }
          })
          .catch(() => {
            // Rollback on network failure
            highlightsRef.current = highlightsRef.current.map((h) =>
              h.id === id ? prevHighlight : h
            );
            setHighlights(highlightsRef.current);
            viewRef.current?.renderer?.getContents?.()?.forEach((c) => {
              c.overlayer?.redraw?.();
            });
            setToast({
              message: "Ошибка сети при обновлении категории.",
              onRetry: () => handleSelectCategory(type, note),
            });
          });
      } else {
        const quote = extractTextQuote(currentState.doc, currentState.range);
        const tempId = "temp-" + Date.now();
        const optimisticHighlight: Highlight = {
          id: tempId,
          bookId,
          cfi: currentState.cfi,
          sectionHref: currentState.sectionHref,
          sectionIndex: currentState.sectionIndex,
          selectedText: currentState.selectedText,
          textQuotePrefix: quote.prefix,
          textQuoteSuffix: quote.suffix,
          type,
          note: note ?? null,
          chapterId: null,
          pageNumber: null,
          startPosition: 0,
          endPosition: 0,
          rects: null,
          legacyColor: null,
          createdAt: new Date().toISOString(),
        };

        // 1. Instantly draw in Foliate and update React state (< 16ms)
        highlightsRef.current = [...highlightsRef.current, optimisticHighlight];
        setHighlights(highlightsRef.current);
        void viewRef.current?.addAnnotation({
          value: optimisticHighlight.cfi!,
          type: optimisticHighlight.type,
          highlightId: tempId,
        });

        // 2. Background server action
        saveEpubHighlight({
          bookId,
          cfi: currentState.cfi,
          sectionHref: currentState.sectionHref,
          sectionIndex: currentState.sectionIndex,
          selectedText: currentState.selectedText,
          textQuotePrefix: quote.prefix,
          textQuoteSuffix: quote.suffix,
          type,
          note,
        })
          .then((res) => {
            if (res.ok) {
              highlightsRef.current = highlightsRef.current.map((h) =>
                h.id === tempId ? res.highlight : h
              );
              setHighlights(highlightsRef.current);
            } else {
              // Rollback on server error
              highlightsRef.current = highlightsRef.current.filter((h) => h.id !== tempId);
              setHighlights(highlightsRef.current);
              void viewRef.current?.deleteAnnotation({ value: optimisticHighlight.cfi! });
              setToast({
                message: "Не удалось сохранить выделение на сервере.",
                onRetry: () => {
                  setPopoverState(currentState);
                },
              });
            }
          })
          .catch(() => {
            // Rollback on network failure
            highlightsRef.current = highlightsRef.current.filter((h) => h.id !== tempId);
            setHighlights(highlightsRef.current);
            void viewRef.current?.deleteAnnotation({ value: optimisticHighlight.cfi! });
            setToast({
              message: "Ошибка сети при сохранении выделения.",
              onRetry: () => {
                setPopoverState(currentState);
              },
            });
          });
      }
    };

    const handleDeleteHighlight = () => {
      if (!popoverState?.existingHighlight) return;
      const highlight = popoverState.existingHighlight;
      try {
        popoverState.doc.getSelection()?.removeAllRanges();
      } catch {}
      setPopoverState(null);

      // Optimistically remove from view and state
      const prevHighlights = highlightsRef.current;
      highlightsRef.current = highlightsRef.current.filter((h) => h.id !== highlight.id);
      setHighlights(highlightsRef.current);
      if (highlight.cfi) {
        void viewRef.current?.deleteAnnotation({ value: highlight.cfi });
      }

      removeEpubHighlight(highlight.id)
        .then((res) => {
          if (!res.ok) {
            // Rollback
            highlightsRef.current = prevHighlights;
            setHighlights(prevHighlights);
            if (highlight.cfi) {
              void viewRef.current?.addAnnotation({
                value: highlight.cfi,
                type: highlight.type,
                highlightId: highlight.id,
              });
            }
            setToast({
              message: "Не удалось удалить выделение.",
              onRetry: () => handleDeleteHighlight(),
            });
          }
        })
        .catch(() => {
          // Rollback
          highlightsRef.current = prevHighlights;
          setHighlights(prevHighlights);
          if (highlight.cfi) {
            void viewRef.current?.addAnnotation({
              value: highlight.cfi,
              type: highlight.type,
              highlightId: highlight.id,
            });
          }
          setToast({
            message: "Ошибка сети при удалении выделения.",
            onRetry: () => handleDeleteHighlight(),
          });
        });
    };

    useEffect(() => {
      let cancelled = false;
      let activeView: FoliateViewElement | null = null;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (!viewRef.current) return;
        if (e.key === "ArrowLeft") {
          viewRef.current.prev?.();
        } else if (e.key === "ArrowRight") {
          viewRef.current.next?.();
        }
      };

      const handleResize = () => {
        if (viewRef.current) {
          applyPaginatorAttributes(viewRef.current);
          const origin =
            typeof window !== "undefined" ? window.location.origin : "";
          const isNarrow = checkIsNarrow();
          if (viewRef.current.renderer?.setStyles) {
            const styles = generateEpubStyles(
              theme,
              fontSize,
              bookLangRef.current,
              origin,
              isNarrow
            );
            viewRef.current.renderer.setStyles(styles);
          }

          const docs = getAllDocuments();
          docs.forEach((doc) => applyKazakhAlignment(doc, isNarrow));
        }
      };

      async function initReader() {
        try {
          setIsLoading(true);
          setError(null);

          // 1. Dynamic import of foliate-js view
          // @ts-expect-error - native browser ES module served from public/foliate-js
          await import(/* webpackIgnore: true */ "/foliate-js/view.js");
          if (cancelled) return;

          // 2. Create <foliate-view> custom element
          const view = document.createElement("foliate-view") as FoliateViewElement;
          activeView = view;
          view.style.display = "block";
          view.style.width = "100%";
          view.style.height = "100%";
          view.style.overflow = "hidden";

          // 3. Fetch signed URL from API
          const signedRes = await fetch(
            `/api/books/${encodeURIComponent(bookId)}/epub-signed-url`
          );
          if (!signedRes.ok) {
            const errData = await signedRes.json().catch(() => null);
            throw new Error(
              errData?.error ||
                `Не удалось получить ссылку на книгу (HTTP ${signedRes.status})`
            );
          }
          const { url } = await signedRes.json();
          if (cancelled) {
            view.remove();
            return;
          }

          // 4. Fetch EPUB blob and convert to File
          const fileRes = await fetch(url, { cache: "no-store" });
          if (!fileRes.ok) {
            throw new Error(
              `Ошибка загрузки файла книги (HTTP ${fileRes.status})`
            );
          }
          const blob = await fileRes.blob();
          if (cancelled) {
            view.remove();
            return;
          }

          const file = new File([blob], `${bookId}.epub`, {
            type: "application/epub+zip",
          });

          // 5. Attach view to DOM
          if (containerRef.current) {
            containerRef.current.innerHTML = "";
            containerRef.current.appendChild(view);
          }

          // Attach listeners BEFORE opening the book so initial load and transitions are caught
          const handleRelocate = (e: Event) => {
            const detail = (e as CustomEvent<{
              cfi?: string;
              tocItem?: { label?: string };
              fraction?: number;
              location?: { current: number; total: number };
            }>).detail;
            if (detail?.location && detail.location.total > 0) {
              onProgressRef.current?.(detail.location.current + 1, detail.location.total);
            }
            if (detail?.cfi) {
              try {
                localStorage.setItem(`epub-cfi:${bookId}`, detail.cfi);
              } catch (persistErr) {
                console.warn("Failed to persist CFI", persistErr);
              }
            }

            if (detail?.tocItem?.label) {
              onRelocate(detail.tocItem.label);
            } else if (typeof detail?.fraction === "number") {
              const pct = Math.round(detail.fraction * 100);
              onRelocate(`${pct}%`);
            }

            const isNarrowScreen = checkIsNarrow();
            const docs = getAllDocuments();
            docs.forEach((doc) => applyKazakhAlignment(doc, isNarrowScreen));
          };

          view.addEventListener("relocate", handleRelocate);
          window.addEventListener("keydown", handleKeyDown);
          window.addEventListener("resize", handleResize);

          // Foliate annotation events
          view.addEventListener("draw-annotation", (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!detail?.draw) return;
            const { draw, annotation } = detail;
            const highlight = highlightsRef.current.find(
              (h) => h.cfi === annotation.value || h.id === annotation.value
            );
            const annType =
              annotation.type !== undefined
                ? (annotation.type as HighlightType | null)
                : highlight?.type;
            const annId =
              (annotation.highlightId as string | undefined) || highlight?.id;

            draw((rects: DOMRect[]) =>
              drawEpubHighlight(rects, {
                type: annType,
                theme: themeRef.current,
                highlightId: annId,
              })
            );
          });

          view.addEventListener("show-annotation", (e: Event) => {
            const detail = (e as CustomEvent).detail;
            const { value, range } = detail;
            const highlight = highlightsRef.current.find(
              (h) => h.cfi === value || h.id === value
            );
            if (highlight && range) {
              const rect = range.getBoundingClientRect();
              const docs = getAllDocuments();
              let iframeRect = { left: 0, top: 0 };
              for (const d of docs) {
                if (d.contains(range.startContainer)) {
                  const frame = d.defaultView?.frameElement as HTMLIFrameElement | null;
                  if (frame) iframeRect = frame.getBoundingClientRect();
                  break;
                }
              }
              const clientX = iframeRect.left + rect.left + rect.width / 2;
              const clientY = iframeRect.top + rect.top;
              setPopoverState({
                position: {
                  x: clientX,
                  y: clientY,
                  placement: clientY > 150 ? "top" : "bottom",
                },
                range,
                cfi: highlight.cfi || value,
                selectedText: highlight.selectedText || range.toString(),
                existingHighlight: highlight,
                doc: range.startContainer.ownerDocument || document,
              });
            }
          });

          view.addEventListener("create-overlay", (e: Event) => {
            const { index } = (e as CustomEvent<{ index: number }>).detail;
            void renderHighlightsForSection(index);
          });

          view.addEventListener("load", (evt: Event) => {
            try {
              const detail = (evt as CustomEvent<{ doc?: Document }>).detail;
              const doc = detail?.doc;
              if (doc) {
                doc.addEventListener("keydown", handleKeyDown);
                const isNarrowScreen = checkIsNarrow();
                applyKazakhAlignment(doc, isNarrowScreen);

                const text = doc.body?.textContent || "";
                const hasKazakhChars = /[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/.test(text);
                if (hasKazakhChars && bookLangRef.current !== "kk") {
                  bookLangRef.current = "kk";
                  const originUrl = typeof window !== "undefined" ? window.location.origin : "";
                  const styles = generateEpubStyles(
                    theme,
                    fontSize,
                    "kk",
                    originUrl,
                    isNarrowScreen
                  );
                  view.renderer?.setStyles?.(styles);
                }

                // Selection listeners on chapter document
                const checkSelection = () => {
                  const sel = doc.getSelection();
                  if (!sel || sel.isCollapsed || !sel.rangeCount) return;
                  const range = sel.getRangeAt(0);
                  const selText = range.toString().trim();
                  if (!selText || selText.length < 1) return;

                  const contents = view.renderer?.getContents?.();
                  const contentObj = contents?.find((c) => c.doc === doc);
                  const sectionIndex = contentObj?.index ?? 0;
                  const sectionHref = view.book?.sections?.[sectionIndex]?.href ?? null;

                  // Check if selection intersects an existing highlight (amendment 4)
                  let intersectingHighlight: Highlight | null = null;
                  for (const h of highlightsRef.current) {
                    if (!h.cfi) continue;
                    try {
                      const resolved = view.resolveCFI(h.cfi);
                      if (resolved && resolved.index === sectionIndex) {
                        const hRange = resolved.anchor(doc);
                        if (hRange) {
                          const intersects =
                            range.compareBoundaryPoints(Range.END_TO_START, hRange) < 0 &&
                            range.compareBoundaryPoints(Range.START_TO_END, hRange) > 0;
                          if (intersects) {
                            intersectingHighlight = h;
                            break;
                          }
                        }
                      }
                    } catch {}
                  }

                  const cfi = view.getCFI(sectionIndex, range);
                  const iframe = doc.defaultView?.frameElement as HTMLIFrameElement | null;
                  const iframeRect = iframe ? iframe.getBoundingClientRect() : { left: 0, top: 0 };
                  const rect = range.getBoundingClientRect();
                  const clientX = iframeRect.left + rect.left + rect.width / 2;
                  const clientY = iframeRect.top + rect.top;
                  // On phones the system Copy/Share menu sits above the
                  // selection, so put ours below it.
                  const isTouch =
                    typeof window !== "undefined" &&
                    window.matchMedia("(pointer: coarse)").matches;

                  setPopoverState({
                    position: isTouch
                      ? { x: clientX, y: iframeRect.top + rect.bottom, placement: "bottom" }
                      : {
                          x: clientX,
                          y: clientY,
                          placement: clientY > 150 ? "top" : "bottom",
                        },
                    range,
                    cfi,
                    selectedText: selText,
                    sectionHref,
                    sectionIndex,
                    doc,
                    existingHighlight: intersectingHighlight,
                  });
                };

                doc.addEventListener("mouseup", checkSelection);
                doc.addEventListener("touchend", () => {
                  setTimeout(checkSelection, 120);
                });
                // Phones select by long-press and adjust with handles, which
                // fire no mouseup/touchend; follow the selection itself.
                let selectionTimer: ReturnType<typeof setTimeout> | undefined;
                doc.addEventListener("selectionchange", () => {
                  clearTimeout(selectionTimer);
                  selectionTimer = setTimeout(checkSelection, 300);
                });
              }
            } catch {
              // ignore
            }
          });

          // 6. Open book
          await view.open(file);
          if (cancelled) {
            view.close?.();
            view.remove();
            return;
          }

          viewRef.current = view;

          // Detect book language (ru, en, or kk)
          const detectedLang = detectBookLanguage(view.book);
          bookLangRef.current = detectedLang;

          // 7. Pass TOC to parent shell
          if (view.book?.toc) {
            onTocLoaded(view.book.toc);
          }

          // 8. Configure paginator attributes and styles BEFORE view.init() to eliminate FOUC
          const origin =
            typeof window !== "undefined" ? window.location.origin : "";
          applyPaginatorAttributes(view);

          const isNarrow = checkIsNarrow();
          if (view.renderer?.setStyles) {
            view.renderer.setStyles(
              generateEpubStyles(theme, fontSize, detectedLang, origin, isNarrow)
            );
          }

          // 9. Position restore via localStorage or URL params
          let savedCfi: string | null = null;
          try {
            savedCfi = localStorage.getItem(`epub-cfi:${bookId}`);
          } catch (e) {
            console.warn("Failed to read CFI from localStorage", e);
          }

          if (typeof view.init === "function") {
            await view.init({
              lastLocation: savedCfi || null,
              showTextStart: true,
            });
          }

          // 10. Check URL navigation (?cfi=... or ?section=...)
          try {
            const searchParams = new URLSearchParams(window.location.search);
            const targetCfi = searchParams.get("cfi");
            const targetSection = searchParams.get("section");
            if (targetCfi) {
              await view.goTo(decodeURIComponent(targetCfi));
            } else if (targetSection) {
              await view.goTo(decodeURIComponent(targetSection));
            }
          } catch (e) {
            console.warn("Failed to navigate to target URL parameter", e);
          }

          if (cancelled) {
            view.close?.();
            view.remove();
            return;
          }

          setIsLoading(false);
        } catch (err: unknown) {
          if (!cancelled) {
            console.error("EPUB initialization failed:", err);
            const msg = err instanceof Error ? err.message : String(err);
            setError(
              msg ||
                "Произошла ошибка при загрузке книги. Пожалуйста, попробуйте позже."
            );
            setIsLoading(false);
          }
        }
      }

      initReader();

      return () => {
        cancelled = true;
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("resize", handleResize);
        if (activeView) {
          try {
            activeView.close?.();
            activeView.remove();
          } catch (err) {
            console.warn("Error during foliate-view cleanup", err);
          }
        }
        viewRef.current = null;
      };
    }, [
      bookId,
      onTocLoaded,
      onRelocate,
      applyPaginatorAttributes,
      theme,
      fontSize,
      checkIsNarrow,
      applyKazakhAlignment,
      getAllDocuments,
      renderHighlightsForSection,
    ]);

    return (
      <div
        className="relative flex-1 w-full h-full overflow-hidden transition-colors duration-200"
        style={{
          backgroundColor: palette.bg,
          color: palette.text,
        }}
      >
        {/* Loading overlay with matching background color to prevent theme flashing */}
        {isLoading && !error && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center transition-colors duration-200"
            style={{
              backgroundColor: palette.bg,
            }}
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p
              className="mt-4 text-sm font-medium"
              style={{ color: palette.text, opacity: 0.7 }}
            >
              Загрузка книги...
            </p>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center p-6"
            style={{ backgroundColor: palette.bg }}
          >
            <div className="max-w-md w-full rounded-xl border border-border bg-paper-soft p-6 text-center shadow-md">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 font-serif text-lg font-medium text-ink">
                Не удалось открыть книгу
              </h3>
              <p className="mt-2 text-sm text-ink-muted leading-relaxed">
                {error}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-5 inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-95 transition-opacity"
              >
                Попробовать снова
              </button>
            </div>
          </div>
        )}

        {/* Foliate DOM container */}
        <div ref={containerRef} className="w-full h-full" />

        {/* Highlight action popover */}
        {popoverState && (
          <EpubHighlightPopover
            position={popoverState.position}
            theme={theme}
            existingHighlight={popoverState.existingHighlight}
            onSelectCategory={handleSelectCategory}
            onDelete={popoverState.existingHighlight ? handleDeleteHighlight : undefined}
            onClose={() => {
              try {
                popoverState.doc.getSelection()?.removeAllRanges();
              } catch {}
              setPopoverState(null);
            }}
          />
        )}

        {/* Optimistic Error Toast Notification */}
        {toast && (
          <div
            role="alert"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-stone-900 text-stone-100 shadow-2xl border border-stone-700 text-sm animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <svg
              className="w-4 h-4 text-amber-400 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{toast.message}</span>
            {toast.onRetry && (
              <button
                type="button"
                onClick={() => {
                  const retry = toast.onRetry;
                  setToast(null);
                  retry?.();
                }}
                className="px-2.5 py-1 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-md transition-colors"
              >
                Повторить
              </button>
            )}
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-stone-400 hover:text-stone-200 ml-1 text-base leading-none"
              aria-label="Закрыть уведомление"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    );
  }
);
