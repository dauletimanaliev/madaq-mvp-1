"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Book, Highlight, HighlightType, PdfHighlightRect } from "@/lib/types";
import { HighlightMenu, type SelectionRange } from "./HighlightMenu";
import { PdfPage } from "./PdfPage";
import {
  fetchPdfBookHighlights,
  savePdfHighlight,
  updatePdfHighlightCategory,
  removePdfHighlight,
} from "@/app/books/[bookId]/pdf/actions";
import "pdfjs-dist/web/pdf_viewer.css";

interface PdfReaderProps {
  book: Book;
  /** Signed storage URL (preferred) or the streaming proxy. */
  pdfUrl: string;
  /** Streaming proxy, used if loading from `pdfUrl` fails. */
  fallbackUrl?: string;
  initialPage?: number;
}

interface SearchResult {
  pageNumber: number;
  snippet: string;
}

type LoadedDoc = {
  pdfDoc: PDFDocumentProxy;
  pdfjs: typeof import("pdfjs-dist");
};

const PAGE_GAP = 12; // px between pages
const TOP_PADDING = 64; // keeps the first page clear of the header
const MAX_FIT_WIDTH = 960; // page width at 100% on wide screens
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const EMPTY_HIGHLIGHTS: Highlight[] = [];

function normalizeAndMergeRects(
  clientRects: DOMRect[],
  containerRect: DOMRect
): PdfHighlightRect[] {
  if (!containerRect.width || !containerRect.height) return [];

  const rawBoxes = clientRects
    .map((r) => {
      const left = Math.max(containerRect.left, Math.min(containerRect.right, r.left));
      const right = Math.max(containerRect.left, Math.min(containerRect.right, r.right));
      const top = Math.max(containerRect.top, Math.min(containerRect.bottom, r.top));
      const bottom = Math.max(containerRect.top, Math.min(containerRect.bottom, r.bottom));

      const width = right - left;
      const height = bottom - top;

      if (width <= 1 || height <= 1) return null;

      return {
        x: (left - containerRect.left) / containerRect.width,
        y: (top - containerRect.top) / containerRect.height,
        width: width / containerRect.width,
        height: height / containerRect.height,
      };
    })
    .filter((b): b is PdfHighlightRect => b !== null && b.width > 0.001 && b.height > 0.001);

  if (rawBoxes.length <= 1) return rawBoxes;

  // Sort by vertical position (y), then horizontal (x)
  rawBoxes.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 0.007) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });

  const merged: PdfHighlightRect[] = [];
  let current = { ...rawBoxes[0] };

  for (let i = 1; i < rawBoxes.length; i++) {
    const next = rawBoxes[i];
    const isSameLine =
      Math.abs(current.y - next.y) < 0.008 &&
      Math.abs(current.height - next.height) < 0.012;

    const currentRight = current.x + current.width;
    const isAdjacent = next.x <= currentRight + 0.015 && next.x >= current.x - 0.005;

    if (isSameLine && isAdjacent) {
      const newRight = Math.max(currentRight, next.x + next.width);
      current.width = newRight - current.x;
      current.y = Math.min(current.y, next.y);
      current.height = Math.max(current.height, next.height);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  return merged;
}

const RANGE_CHUNK_SIZE = 524288; // 512 KB: storage is far away, fewer round trips
const CMAP_URL = "https://unpkg.com/pdfjs-dist@4.4.168/cmaps/";

type PdfJs = typeof import("pdfjs-dist");

const PREFETCH_MAX_BYTES = 25 * 1024 * 1024; // fetch small books fully in the background
const PREFETCH_CONCURRENCY = 4;

/**
 * Opens a cross-origin PDF by fetching byte ranges ourselves.
 *
 * Supabase Storage answers Range requests, but does not expose the
 * `Accept-Ranges` header over CORS, so PDF.js on its own believes ranges are
 * unsupported and downloads the whole file before showing anything. With a
 * PDFDataRangeTransport we fetch fixed-size chunks, keep them in memory and
 * answer each PDF.js range request from them.
 *
 * Books up to PREFETCH_MAX_BYTES are downloaded in parallel right away: PDF.js
 * asks for chunks one after another (often most of the file before the first
 * page, for embedded fonts and images), so waiting for each request costs a
 * round trip per chunk. Chunks PDF.js asks for jump the queue.
 * Returns null when the server ignores Range.
 */
async function openPdfByRanges(
  pdfjs: PdfJs,
  url: string,
  knownLength: number | null | undefined,
  signal: AbortSignal
) {
  const fetchRange = (begin: number, end: number) =>
    fetch(url, { headers: { Range: `bytes=${begin}-${end - 1}` }, signal }).then((r) => {
      if (r.status !== 206) throw new Error(`Range request failed: ${r.status}`);
      return r.arrayBuffer().then((buf) => new Uint8Array(buf));
    });

  const lengthPromise = knownLength
    ? Promise.resolve(knownLength)
    : fetch(url, { method: "HEAD", signal }).then((r) =>
        Number(r.headers.get("content-length")) || 0
      );
  const firstChunkPromise = fetchRange(0, RANGE_CHUNK_SIZE).catch(() => null);

  const length = await lengthPromise;
  const chunkCount = Math.ceil(length / RANGE_CHUNK_SIZE);
  const chunks = new Map<number, Promise<Uint8Array>>();

  const getChunk = (index: number): Promise<Uint8Array> => {
    const existing = chunks.get(index);
    if (existing) return existing;
    const begin = index * RANGE_CHUNK_SIZE;
    const end = Math.min(length, begin + RANGE_CHUNK_SIZE);
    // One retry for flaky mobile networks.
    const promise = fetchRange(begin, end).catch(() => fetchRange(begin, end));
    promise.catch(() => chunks.delete(index));
    chunks.set(index, promise);
    return promise;
  };

  // The cross-reference table sits at the end of the file and is needed
  // right after the header, so fetch it alongside the first chunk.
  if (chunkCount > 1) void getChunk(chunkCount - 1).catch(() => {});

  const initialData = await firstChunkPromise;
  if (!length || !initialData) return null;
  chunks.set(0, Promise.resolve(initialData));

  const transport = new pdfjs.PDFDataRangeTransport(length, initialData);
  // PDF.js accepts data only for a range it asked for, delivered in one piece.
  transport.requestDataRange = (begin: number, end: number) => {
    const first = Math.floor(begin / RANGE_CHUNK_SIZE);
    const last = Math.ceil(end / RANGE_CHUNK_SIZE) - 1;
    const parts: Promise<Uint8Array>[] = [];
    for (let i = first; i <= last; i++) parts.push(getChunk(i));
    Promise.all(parts)
      .then((loaded) => {
        const joined = new Uint8Array(loaded.reduce((n, c) => n + c.length, 0));
        let offset = 0;
        for (const c of loaded) {
          joined.set(c, offset);
          offset += c.length;
        }
        const from = begin - first * RANGE_CHUNK_SIZE;
        transport.onDataRange(begin, joined.subarray(from, from + (end - begin)));
      })
      .catch((err) => {
        if (!signal.aborted) console.warn("PDF range load failed:", err);
      });
  };

  if (length <= PREFETCH_MAX_BYTES) {
    const queue = Array.from({ length: chunkCount }, (_, i) => i).filter((i) => !chunks.has(i));
    const worker = async () => {
      while (queue.length > 0 && !signal.aborted) {
        await getChunk(queue.shift() as number).catch(() => {});
      }
    };
    for (let i = 0; i < PREFETCH_CONCURRENCY; i++) void worker();
  }

  const loadingTask = pdfjs.getDocument({
    range: transport,
    rangeChunkSize: RANGE_CHUNK_SIZE,
    disableAutoFetch: true,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
  });
  return loadingTask;
}

/** Index of the last page element whose top is at or above `y` (binary search). */
function pageIndexAt(pages: HTMLCollection, y: number): number {
  let lo = 0;
  let hi = pages.length - 1;
  let found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const el = pages[mid] as HTMLElement;
    if (el.offsetTop <= y) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

function pageElementFromNode(node: Node | null): HTMLElement | null {
  const el = node instanceof Element ? node : node?.parentElement;
  return (el?.closest("[data-pdf-page]") as HTMLElement | null) ?? null;
}

export function PdfReader({ book, pdfUrl, fallbackUrl, initialPage }: PdfReaderProps) {
  const [doc, setDoc] = useState<LoadedDoc | null>(null);
  const [numPages, setNumPages] = useState<number>(book.totalPages || 0);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activePdfUrl, setActivePdfUrl] = useState<string>(pdfUrl);

  // Layout
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [defaultRatio, setDefaultRatio] = useState(1.414);
  const [pageRatios, setPageRatios] = useState<Record<number, number>>({});
  const [visibleRange, setVisibleRange] = useState({ first: 1, last: 1 });
  const [currentPage, setCurrentPage] = useState<number>(
    initialPage && initialPage >= 1 ? initialPage : 1
  );

  // Chrome
  const [chromeVisible, setChromeVisible] = useState(true);
  const [pageDraft, setPageDraft] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Results for the last query that finished loading; the spinner and the
  // visible list are derived from it instead of being reset inside effects.
  const [searchState, setSearchState] = useState<{
    query: string;
    results: SearchResult[];
  }>({ query: "", results: [] });
  const trimmedSearchQuery = searchQuery.trim();
  const isSearchActive = trimmedSearchQuery.length >= 2;
  const isSearching = isSearchActive && searchState.query !== trimmedSearchQuery;
  const searchResults = isSearchActive ? searchState.results : [];

  // Highlights
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [activeSelection, setActiveSelection] = useState<SelectionRange | null>(null);
  const [pendingHighlightData, setPendingHighlightData] = useState<{
    pageNumber: number;
    rects: PdfHighlightRect[];
    selectedText: string;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const pendingScrollPageRef = useRef<number | null>(
    initialPage && initialPage >= 1 ? initialPage : null
  );
  const userScrolledRef = useRef(false);
  const progressReadyRef = useRef(Boolean(initialPage && initialPage >= 1));
  const anchorRef = useRef({ page: 1, fraction: 0 });
  const lastScrollTopRef = useRef(0);
  const activeSelectionRef = useRef<SelectionRange | null>(null);
  useEffect(() => {
    activeSelectionRef.current = activeSelection;
  }, [activeSelection]);

  const fitWidth = Math.max(
    0,
    Math.min(containerWidth - (containerWidth < 640 ? 16 : 64), MAX_FIT_WIDTH)
  );
  const pageWidth = Math.round(fitWidth * zoom);

  const highlightsByPage = useMemo(() => {
    const map: Record<number, Highlight[]> = {};
    for (const h of highlights) {
      if (!h.pageNumber) continue;
      (map[h.pageNumber] ??= []).push(h);
    }
    return map;
  }, [highlights]);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // 2. Load the document with range requests (no full download up front).
  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    const abort = new AbortController();

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const isCrossOrigin = new URL(activePdfUrl, window.location.href).origin !== window.location.origin;
        const byRanges = isCrossOrigin
          ? await openPdfByRanges(pdfjs, activePdfUrl, book.fileSizeBytes, abort.signal)
          : null;
        const loadingTask =
          byRanges ??
          // Same-origin proxy exposes all headers, so PDF.js handles ranges itself.
          pdfjs.getDocument({
            url: activePdfUrl,
            rangeChunkSize: RANGE_CHUNK_SIZE,
            disableAutoFetch: true,
            disableStream: true,
            cMapUrl: CMAP_URL,
            cMapPacked: true,
          });
        if (cancelled) {
          loadingTask.destroy();
          return;
        }
        const pdfDoc = await loadingTask.promise;
        loaded = pdfDoc;
        if (cancelled) return;

        const first = await pdfDoc.getPage(1);
        if (cancelled) return;
        const base = first.getViewport({ scale: 1 });

        setDefaultRatio(base.height / base.width);
        setNumPages(pdfDoc.numPages);
        setDoc({ pdfDoc, pdfjs });
      } catch (err: unknown) {
        if (cancelled) return;
        // A signed URL can expire or be blocked; retry once through the proxy.
        if (fallbackUrl && activePdfUrl !== fallbackUrl) {
          console.warn("PDF load via signed URL failed, using proxy:", err);
          setActivePdfUrl(fallbackUrl);
          return;
        }
        console.error("PDF load error:", err);
        setError(
          (err instanceof Error && err.message) ||
            "Не удалось загрузить PDF. Проверьте подключение к сети."
        );
      }
    })();

    return () => {
      cancelled = true;
      abort.abort();
      loaded?.destroy();
    };
  }, [activePdfUrl, fallbackUrl, reloadKey, book.fileSizeBytes]);

  // 3. Restore reading position: local copy first, then the server value.
  useEffect(() => {
    if (initialPage && initialPage >= 1) return;
    let active = true;

    let localPage = 0;
    try {
      localPage = parseInt(localStorage.getItem(`madaq_progress_${book.id}`) || "", 10) || 0;
    } catch {}
    if (localPage > 1) pendingScrollPageRef.current = localPage;

    fetch(`/api/books/${book.id}/progress`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        const serverPage = data?.lastReadPage;
        if (serverPage > 1 && serverPage !== localPage && !userScrolledRef.current) {
          pendingScrollPageRef.current = serverPage;
          // If the document is already laid out, jump right away.
          const el = pagesRef.current?.children[serverPage - 1] as HTMLElement | undefined;
          if (el && scrollRef.current) {
            scrollRef.current.scrollTop = el.offsetTop - PAGE_GAP;
            pendingScrollPageRef.current = null;
            showToast(`Продолжаем с ${serverPage} страницы`);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        progressReadyRef.current = true;
      });

    return () => {
      active = false;
    };
  }, [book.id, initialPage, showToast]);

  // 4. Load all PDF highlights of the book once.
  useEffect(() => {
    let active = true;
    fetchPdfBookHighlights(book.id)
      .then((list) => {
        if (active) setHighlights(list);
      })
      .catch((err) => console.warn("Could not load PDF highlights:", err));
    return () => {
      active = false;
    };
  }, [book.id]);

  // Track the available width (fit-to-width layout).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(Math.round(entries[0].contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const updateVisiblePages = useCallback(() => {
    const scroller = scrollRef.current;
    const pages = pagesRef.current?.children;
    if (!scroller || !pages || pages.length === 0) return;

    const top = scroller.scrollTop;
    const firstIdx = pageIndexAt(pages, top);
    const lastIdx = pageIndexAt(pages, top + scroller.clientHeight);
    const currentIdx = pageIndexAt(pages, top + scroller.clientHeight * 0.4);

    const firstEl = pages[firstIdx] as HTMLElement;
    anchorRef.current = {
      page: firstIdx + 1,
      fraction: firstEl.offsetHeight
        ? (top - firstEl.offsetTop) / firstEl.offsetHeight
        : 0,
    };

    setVisibleRange((prev) =>
      prev.first === firstIdx + 1 && prev.last === lastIdx + 1
        ? prev
        : { first: firstIdx + 1, last: lastIdx + 1 }
    );
    setCurrentPage(currentIdx + 1);
  }, []);

  const scrollToPage = useCallback((pageNumber: number) => {
    const el = pagesRef.current?.children[pageNumber - 1] as HTMLElement | undefined;
    if (el && scrollRef.current) {
      scrollRef.current.scrollTop = el.offsetTop - PAGE_GAP;
    }
  }, []);

  // After layout is ready, jump to the restored page once.
  useLayoutEffect(() => {
    if (!doc || pageWidth <= 0) return;
    const target = pendingScrollPageRef.current;
    if (target && target > 1) {
      scrollToPage(Math.min(target, doc.pdfDoc.numPages));
      if (!initialPage) showToast(`Продолжаем с ${target} страницы`);
    }
    pendingScrollPageRef.current = null;
    updateVisiblePages();
    // Only on first layout of a loaded document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, pageWidth > 0]);

  // Keep the same spot on screen when zoom or window width changes.
  const prevPageWidthRef = useRef(pageWidth);
  useLayoutEffect(() => {
    const prev = prevPageWidthRef.current;
    prevPageWidthRef.current = pageWidth;
    if (!doc || prev <= 0 || prev === pageWidth) return;
    const { page, fraction } = anchorRef.current;
    const el = pagesRef.current?.children[page - 1] as HTMLElement | undefined;
    if (el && scrollRef.current) {
      scrollRef.current.scrollTop = el.offsetTop + fraction * el.offsetHeight;
    }
    updateVisiblePages();
  }, [pageWidth, doc, updateVisiblePages]);

  const handleScroll = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    userScrolledRef.current = true;

    const top = scroller.scrollTop;
    const delta = top - lastScrollTopRef.current;
    lastScrollTopRef.current = top;
    if (delta > 6 && top > TOP_PADDING) setChromeVisible(false);
    else if (delta < -6) setChromeVisible(true);

    if (activeSelectionRef.current && Math.abs(delta) > 0) {
      setActiveSelection(null);
      setPendingHighlightData(null);
    }

    updateVisiblePages();
  }, [updateVisiblePages]);

  // 5. Auto-save reading progress (debounced).
  useEffect(() => {
    if (!doc || !progressReadyRef.current) return;
    try {
      localStorage.setItem(`madaq_progress_${book.id}`, String(currentPage));
    } catch {}
    const timer = setTimeout(() => {
      fetch(`/api/books/${book.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: currentPage, totalPages: numPages }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [currentPage, numPages, book.id, doc]);

  const handleAspectRatio = useCallback((pageNumber: number, ratio: number) => {
    setPageRatios((prev) =>
      Math.abs((prev[pageNumber] ?? 0) - ratio) < 0.001
        ? prev
        : { ...prev, [pageNumber]: ratio }
    );
  }, []);

  // Selection → open highlight menu.
  const handleSelectionEnd = useCallback(() => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      const selText = sel.toString().trim();
      if (!selText) return;

      const range = sel.getRangeAt(0);
      const pageEl = pageElementFromNode(range.startContainer);
      if (!pageEl) return;
      const pageNumber = Number(pageEl.dataset.pdfPage);

      // Rects outside the starting page collapse to zero size and are dropped.
      const rects = normalizeAndMergeRects(
        Array.from(range.getClientRects()),
        pageEl.getBoundingClientRect()
      );
      if (rects.length === 0) return;

      setPendingHighlightData({ pageNumber, rects, selectedText: selText });
      setActiveSelection({
        rect: range.getBoundingClientRect(),
        existingHighlight: null,
      });
    }, 20);
  }, []);

  // Click → open an existing highlight, close the menu, or toggle the header.
  const handlePagesClick = (e: React.MouseEvent) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return;

    const pageEl = pageElementFromNode(e.target as Node);
    if (pageEl) {
      const pageNumber = Number(pageEl.dataset.pdfPage);
      const box = pageEl.getBoundingClientRect();
      const x = (e.clientX - box.left) / box.width;
      const y = (e.clientY - box.top) / box.height;
      const hit = (highlightsByPage[pageNumber] || []).find((h) =>
        ((h.rects as PdfHighlightRect[]) || []).some(
          (r) =>
            x >= r.x - 0.005 &&
            x <= r.x + r.width + 0.005 &&
            y >= r.y - 0.005 &&
            y <= r.y + r.height + 0.005
        )
      );
      if (hit) {
        setPendingHighlightData(null);
        setActiveSelection({
          rect: {
            left: e.clientX,
            top: e.clientY,
            right: e.clientX,
            bottom: e.clientY,
            width: 0,
            height: 0,
          } as DOMRect,
          existingHighlight: hit,
        });
        return;
      }
    }

    if (activeSelection) {
      setActiveSelection(null);
      setPendingHighlightData(null);
      return;
    }
    setChromeVisible((v) => !v);
  };

  const handleSelectHighlightColor = async (type: HighlightType) => {
    if (activeSelection?.existingHighlight) {
      const targetId = activeSelection.existingHighlight.id;
      const updated: Highlight = { ...activeSelection.existingHighlight, type };
      setHighlights((prev) => prev.map((h) => (h.id === targetId ? updated : h)));
      setActiveSelection(null);
      try {
        await updatePdfHighlightCategory(targetId, type);
      } catch (err) {
        console.warn("Failed to update highlight category:", err);
      }
    } else if (pendingHighlightData) {
      const { pageNumber, rects, selectedText } = pendingHighlightData;
      const tempId = `temp-${Date.now()}`;
      const tempHighlight: Highlight = {
        id: tempId,
        bookId: book.id,
        pageNumber,
        rects,
        selectedText,
        type,
        legacyColor: null,
        createdAt: new Date().toISOString(),
      };
      setHighlights((prev) => [...prev, tempHighlight]);
      setActiveSelection(null);
      setPendingHighlightData(null);
      window.getSelection()?.removeAllRanges();

      try {
        const res = await savePdfHighlight({
          bookId: book.id,
          pageNumber,
          rects,
          selectedText,
          type,
        });
        setHighlights((prev) =>
          res.ok
            ? prev.map((h) => (h.id === tempId ? res.highlight : h))
            : prev.filter((h) => h.id !== tempId)
        );
        if (!res.ok) showToast(res.message);
      } catch {
        setHighlights((prev) => prev.filter((h) => h.id !== tempId));
      }
    }
  };

  const handleDeleteHighlight = async () => {
    if (!activeSelection?.existingHighlight) return;
    const targetId = activeSelection.existingHighlight.id;
    setHighlights((prev) => prev.filter((h) => h.id !== targetId));
    setActiveSelection(null);
    try {
      await removePdfHighlight(targetId);
    } catch {
      // ignore
    }
  };

  // In-book search (debounced).
  useEffect(() => {
    if (!isSearchActive) return;
    const query = trimmedSearchQuery;
    const handler = setTimeout(async () => {
      let results: SearchResult[] = [];
      try {
        const res = await fetch(
          `/api/books/${book.id}/search-content?q=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const data = await res.json();
          results = data.results || [];
        }
      } catch (err) {
        console.error("In-book search error:", err);
      } finally {
        setSearchState({ query, results });
      }
    }, 250);
    return () => clearTimeout(handler);
  }, [isSearchActive, trimmedSearchQuery, book.id]);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setChromeVisible(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        openSearch();
        return;
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        return;
      }
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;

      if (e.key === "ArrowRight" || e.key === "j") {
        e.preventDefault();
        scrollToPage(Math.min(currentPage + 1, numPages));
      } else if (e.key === "ArrowLeft" || e.key === "k") {
        e.preventDefault();
        scrollToPage(Math.max(currentPage - 1, 1));
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => Math.min(+(z + 0.25).toFixed(2), MAX_ZOOM));
      } else if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(+(z - 0.25).toFixed(2), MIN_ZOOM));
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, numPages, searchOpen, openSearch, scrollToPage]);

  const submitPageDraft = (e?: React.FormEvent) => {
    e?.preventDefault();
    const p = parseInt(pageDraft ?? "", 10);
    if (!isNaN(p) && p >= 1 && p <= numPages) scrollToPage(p);
    setPageDraft(null);
  };

  const jumpToPage = (pageNumber: number) => {
    if (pageNumber < 1 || pageNumber > numPages) return;
    scrollToPage(pageNumber);
    if (window.innerWidth < 768) setSearchOpen(false);
  };

  // Pages near the viewport get rendered; the rest stay as sized placeholders.
  const activeFirst = visibleRange.first - 1;
  const activeLast = visibleRange.last + 2;
  const isLoading = !doc && !error;

  return (
    <div className="relative flex h-dvh w-screen flex-col overflow-hidden bg-[#e9e6e1] text-ink select-none">
      {/* Header: overlays the pages and hides while reading */}
      <header
        className={`absolute inset-x-0 top-0 z-30 flex h-12 items-center gap-2 border-b border-border/60 bg-paper-soft/90 px-2 backdrop-blur-md transition-transform duration-200 sm:px-4 ${
          chromeVisible || searchOpen ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <Link
          href={`/books/${book.id}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-border/60 hover:text-ink"
          title="Назад к книге"
          aria-label="Назад к книге"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <h1 className="min-w-0 flex-1 truncate text-center font-serif text-sm text-ink">
          {book.title}
        </h1>

        {numPages > 0 && (
          <form onSubmit={submitPageDraft} className="flex shrink-0 items-center text-xs text-ink-muted">
            {pageDraft !== null ? (
              <input
                autoFocus
                inputMode="numeric"
                value={pageDraft}
                onChange={(e) => setPageDraft(e.target.value)}
                onBlur={() => submitPageDraft()}
                className="h-7 w-12 rounded border border-border bg-paper text-center font-mono text-xs text-ink focus:border-accent focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setPageDraft(String(currentPage))}
                className="rounded px-1.5 py-1 font-mono tabular-nums text-ink hover:bg-border/60"
                title="Перейти к странице"
              >
                {currentPage}
              </button>
            )}
            <span className="pl-1 font-mono tabular-nums">/ {numPages}</span>
          </form>
        )}

        <button
          onClick={() => (searchOpen ? setSearchOpen(false) : openSearch())}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors ${
            searchOpen ? "bg-accent text-paper-soft" : "text-ink-muted hover:bg-border/60 hover:text-ink"
          }`}
          title="Поиск в книге (Cmd+F)"
          aria-label="Поиск в книге"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </header>

      {toastMessage && (
        <div className="absolute top-16 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-paper-soft/95 px-4 py-2 text-xs text-ink shadow-lg backdrop-blur-md">
          {toastMessage}
        </div>
      )}

      {/* Search drawer */}
      {searchOpen && (
        <aside className="absolute top-12 bottom-0 left-0 z-30 flex w-full flex-col border-r border-border bg-paper-soft shadow-2xl sm:w-80">
          <div className="flex items-center gap-2 p-3">
            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Слово или фраза…"
                className="w-full rounded-md border border-border bg-paper py-2 pr-3 pl-8 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-ink-muted">
                {isSearching ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-accent" />
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </div>
            </div>
            <button
              onClick={() => setSearchOpen(false)}
              className="rounded-md p-1.5 text-ink-muted hover:bg-border/60 hover:text-ink"
              aria-label="Закрыть поиск"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {isSearchActive && searchResults.length === 0 && !isSearching && (
              <p className="mt-4 text-center text-xs text-ink-muted">Ничего не найдено</p>
            )}
            {searchResults.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-ink-muted">Найдено: {searchResults.length}</p>
                {searchResults.map((res, i) => (
                  <button
                    key={i}
                    onClick={() => jumpToPage(res.pageNumber)}
                    className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-colors ${
                      currentPage === res.pageNumber
                        ? "border-accent bg-accent/10"
                        : "border-border bg-paper hover:border-accent/40"
                    }`}
                  >
                    <span className="text-[11px] font-medium text-accent">Страница {res.pageNumber}</span>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink">{res.snippet}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Pages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-auto overscroll-contain"
      >
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-ink-muted">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
            <p className="text-sm">Открываем книгу…</p>
          </div>
        )}

        {error && (
          <div className="mx-auto mt-32 max-w-sm px-6 text-center">
            <p className="font-serif text-lg text-ink">Не удалось открыть PDF</p>
            <p className="mt-2 text-xs text-ink-muted">{error}</p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={() => {
                  setError(null);
                  setReloadKey((k) => k + 1);
                }}
                className="rounded-md bg-accent px-4 py-2 text-xs font-medium text-paper-soft hover:opacity-90"
              >
                Повторить
              </button>
              <Link
                href={`/books/${book.id}`}
                className="rounded-md border border-border px-4 py-2 text-xs text-ink hover:bg-paper-soft"
              >
                К книге
              </Link>
            </div>
          </div>
        )}

        {doc && pageWidth > 0 && (
          <div
            ref={pagesRef}
            onMouseUp={handleSelectionEnd}
            onTouchEnd={handleSelectionEnd}
            onClick={handlePagesClick}
            className="relative mx-auto flex w-max min-w-full flex-col items-center"
            style={{ gap: PAGE_GAP, paddingTop: TOP_PADDING, paddingBottom: 48 }}
          >
            {Array.from({ length: numPages }, (_, i) => {
              const pageNumber = i + 1;
              return (
                <PdfPage
                  key={pageNumber}
                  pdfDoc={doc.pdfDoc}
                  pdfjs={doc.pdfjs}
                  pageNumber={pageNumber}
                  width={pageWidth}
                  aspectRatio={pageRatios[pageNumber] ?? defaultRatio}
                  isActive={pageNumber >= activeFirst && pageNumber <= activeLast}
                  highlights={highlightsByPage[pageNumber] ?? EMPTY_HIGHLIGHTS}
                  onAspectRatio={handleAspectRatio}
                />
              );
            })}
          </div>
        )}
      </div>

      <HighlightMenu
        bookId={book.id}
        selection={activeSelection}
        onCustomSelectColor={handleSelectHighlightColor}
        onCustomDelete={handleDeleteHighlight}
        onClose={() => {
          setActiveSelection(null);
          setPendingHighlightData(null);
          window.getSelection()?.removeAllRanges();
        }}
      />
    </div>
  );
}
