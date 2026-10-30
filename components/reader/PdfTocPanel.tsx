"use client";

import { useEffect, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export interface PdfTocItem {
  title: string;
  /** 1-based page, or null when the entry has no page (e.g. a web link). */
  page: number | null;
  depth: number;
}

type OutlineNode = Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>[number];

async function resolvePage(pdfDoc: PDFDocumentProxy, dest: OutlineNode["dest"]): Promise<number | null> {
  try {
    const explicit = typeof dest === "string" ? await pdfDoc.getDestination(dest) : dest;
    if (!Array.isArray(explicit) || explicit.length === 0) return null;
    const target = explicit[0];
    // Some PDFs store a page index instead of a page reference.
    if (typeof target === "number") return target + 1;
    if (target && typeof target === "object") {
      return (await pdfDoc.getPageIndex(target as Parameters<PDFDocumentProxy["getPageIndex"]>[0])) + 1;
    }
  } catch {
    // Broken destination: show the entry without a page.
  }
  return null;
}

/** Reads the PDF's built-in table of contents as a flat list with depth. */
export async function loadPdfToc(pdfDoc: PDFDocumentProxy): Promise<PdfTocItem[]> {
  const outline = await pdfDoc.getOutline();
  if (!outline || outline.length === 0) return [];

  const flat: { node: OutlineNode; depth: number }[] = [];
  const walk = (nodes: OutlineNode[], depth: number) => {
    for (const node of nodes) {
      flat.push({ node, depth });
      if (node.items?.length) walk(node.items, depth + 1);
    }
  };
  walk(outline, 0);

  const pages = await Promise.all(flat.map(({ node }) => resolvePage(pdfDoc, node.dest)));
  return flat.map(({ node, depth }, i) => ({
    title: node.title?.trim() || "Без названия",
    page: pages[i],
    depth,
  }));
}

/** Index of the entry the reader is in now: the last one starting at or before the page. */
export function activeTocIndex(items: PdfTocItem[], currentPage: number): number {
  let best = -1;
  let bestPage = 0;
  items.forEach((item, i) => {
    if (item.page !== null && item.page <= currentPage && item.page >= bestPage) {
      best = i;
      bestPage = item.page;
    }
  });
  return best;
}

interface PdfTocPanelProps {
  items: PdfTocItem[] | null;
  currentPage: number;
  onNavigate: (page: number) => void;
  onClose: () => void;
}

export function PdfTocPanel({ items, currentPage, onNavigate, onClose }: PdfTocPanelProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const active = items ? activeTocIndex(items, currentPage) : -1;

  // Open the list scrolled to the chapter being read. Scroll only the list:
  // scrollIntoView would also shift the reader behind it.
  useEffect(() => {
    const el = activeRef.current;
    const list = el?.closest("nav");
    if (el && list) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2;
  }, [items]);

  return (
    <aside className="absolute top-12 bottom-0 left-0 z-30 flex w-full flex-col border-r border-neutral-200 bg-white shadow-2xl sm:w-80">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-serif text-base text-ink">Оглавление</span>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-ink-muted hover:bg-neutral-100 hover:text-ink"
          aria-label="Закрыть оглавление"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="relative flex-1 overflow-y-auto px-2 pb-4" aria-label="Оглавление">
        {items === null && (
          <div className="flex justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-accent" />
          </div>
        )}

        {items !== null && items.length === 0 && (
          <p className="px-3 py-10 text-center text-sm text-ink-muted">
            В этой книге нет встроенного оглавления.
            <br />
            Перейти к странице можно через номер страницы вверху.
          </p>
        )}

        {items?.map((item, i) => {
          const isActive = i === active;
          return (
            <button
              key={i}
              ref={isActive ? activeRef : undefined}
              type="button"
              disabled={item.page === null}
              onClick={() => item.page !== null && onNavigate(item.page)}
              className={`flex w-full items-baseline gap-3 rounded-md py-2 pr-3 text-left text-sm transition-colors disabled:cursor-default disabled:opacity-50 ${
                isActive ? "bg-accent/10 text-accent" : "text-ink hover:bg-neutral-100"
              } ${item.depth === 0 ? "font-medium" : ""}`}
              style={{ paddingLeft: 12 + Math.min(item.depth, 4) * 16 }}
              aria-current={isActive ? "location" : undefined}
            >
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{item.title}</span>
              {item.page !== null && (
                <span className={`shrink-0 font-mono text-xs tabular-nums ${isActive ? "text-accent" : "text-ink-muted"}`}>
                  {item.page}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
