"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import type { Book, Highlight, HighlightType, PdfHighlightRect } from "@/lib/types";
import { HighlightMenu, type SelectionRange } from "./HighlightMenu";
import {
  fetchPdfPageHighlights,
  savePdfHighlight,
  updatePdfHighlightCategory,
  removePdfHighlight,
} from "@/app/books/[bookId]/pdf/actions";
import "pdfjs-dist/web/pdf_viewer.css";

interface PdfReaderProps {
  book: Book;
  pdfUrl: string;
  initialPage?: number;
}

interface SearchResult {
  pageNumber: number;
  snippet: string;
}

const highlightBgStyles: Record<HighlightType, string> = {
  protein: "bg-red-400/40 border-b border-red-500/50",
  carbohydrate: "bg-orange-400/40 border-b border-orange-500/50",
  fat: "bg-amber-300/45 border-b border-amber-500/50",
  vitamin: "bg-emerald-400/40 border-b border-emerald-500/50",
  fiber: "bg-sky-400/40 border-b border-sky-500/50",
};

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

export function PdfReader({ book, pdfUrl, initialPage }: PdfReaderProps) {
  const [numPages, setNumPages] = useState<number>(book.totalPages || 0);
  const [currentPage, setCurrentPage] = useState<number>(
    initialPage && initialPage >= 1 ? initialPage : 1
  );
  const [scale, setScale] = useState<number>(1.2);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState<string>(
    String(initialPage && initialPage >= 1 ? initialPage : 1)
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activePdfUrl, setActivePdfUrl] = useState<string>(pdfUrl);

  // In-book search state (ТЗ §4)
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Highlights and TextLayer state
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [activeSelection, setActiveSelection] = useState<SelectionRange | null>(null);
  const [pendingHighlightData, setPendingHighlightData] = useState<{
    rects: PdfHighlightRect[];
    selectedText: string;
  } | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const pdfjsLibRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const textLayerTaskRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // 1. Fetch direct CDN Signed URL (ТЗ §2)
  useEffect(() => {
    let active = true;
    async function fetchSignedUrl() {
      try {
        const res = await fetch(`/api/books/${book.id}/signed-pdf-url`);
        if (res.ok && active) {
          const data = await res.json();
          if (data.signedUrl) {
            setActivePdfUrl(data.signedUrl);
          }
        }
      } catch {
        // Keep fallback pdfUrl
      }
    }
    fetchSignedUrl();
    return () => {
      active = false;
    };
  }, [book.id]);

  // 2. Restore reading progress on mount (ТЗ §1: last_read_page)
  useEffect(() => {
    let active = true;
    async function restoreProgress() {
      if (initialPage && initialPage >= 1) {
        return;
      }

      try {
        // Fast local restore first
        const local = localStorage.getItem(`madaq_progress_${book.id}`);
        if (local) {
          const p = parseInt(local, 10);
          if (p > 1) {
            setCurrentPage(p);
            setPageInput(String(p));
            setToastMessage(`Продолжаем с ${p} страницы`);
            setTimeout(() => setToastMessage(null), 3500);
          }
        }

        // Database sync
        const res = await fetch(`/api/books/${book.id}/progress`);
        if (res.ok && active) {
          const data = await res.json();
          if (
            data.lastReadPage &&
            data.lastReadPage > 1 &&
            (!local || parseInt(local, 10) !== data.lastReadPage)
          ) {
            setCurrentPage(data.lastReadPage);
            setPageInput(String(data.lastReadPage));
            setToastMessage(`Продолжаем с ${data.lastReadPage} страницы`);
            setTimeout(() => setToastMessage(null), 3500);
          }
        }
      } catch (err) {
        console.warn("Could not restore reading progress:", err);
      }
    }
    restoreProgress();
    return () => {
      active = false;
    };
  }, [book.id, initialPage]);

  // 3. Auto-save reading progress on page change (debounced 600ms, ТЗ §1)
  useEffect(() => {
    if (isLoading || currentPage < 1) return;

    try {
      localStorage.setItem(`madaq_progress_${book.id}`, String(currentPage));
    } catch {}

    const timer = setTimeout(() => {
      fetch(`/api/books/${book.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: currentPage, totalPages: numPages }),
      }).catch(() => {});
    }, 600);

    return () => clearTimeout(timer);
  }, [currentPage, numPages, book.id, isLoading]);

  // 4. Load PDF Document with HTTP 206 Progressive Streaming
  useEffect(() => {
    let isCancelled = false;

    async function initPdf() {
      setIsLoading(true);
      setError(null);
      setLoadingProgress(10);

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        pdfjsLibRef.current = pdfjs;

        setLoadingProgress(30);

        // Progressive streaming with 64KB range chunks (ТЗ §2)
        const loadingTask = pdfjs.getDocument({
          url: activePdfUrl,
          rangeChunkSize: 65536, // 64 KB chunks for progressive loading
          disableAutoFetch: true, // Don't download entire 100+ MB file at once
          disableStream: false,
          cMapUrl: "https://unpkg.com/pdfjs-dist@4.4.168/cmaps/",
          cMapPacked: true,
        });

        loadingTask.onProgress = (progressData: { loaded: number; total: number }) => {
          if (progressData.total > 0) {
            const percent = Math.min(
              90,
              Math.round((progressData.loaded / progressData.total) * 90)
            );
            setLoadingProgress(percent);
          }
        };

        const pdfDoc = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);
        setLoadingProgress(100);
        setIsLoading(false);
      } catch (err: any) {
        if (!isCancelled) {
          console.error("PDF progressive load error:", err);
          setError(
            err.message ||
              "Не удалось загрузить PDF документ. Проверьте подключение к сети."
          );
          setIsLoading(false);
        }
      }
    }

    initPdf();

    return () => {
      isCancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy?.();
      }
    };
  }, [activePdfUrl]);

  // 5. Render Current Page & TextLayer
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDocRef.current || !canvasRef.current) return;

      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdfDocRef.current.getPage(pageNum);
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;

        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;

        const vpWidth = Math.floor(viewport.width);
        const vpHeight = Math.floor(viewport.height);
        setPageDimensions({ width: vpWidth, height: vpHeight });

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${vpWidth}px`;
        canvas.style.height = `${vpHeight}px`;

        const transform =
          outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        const renderContext = {
          canvasContext: context,
          transform,
          viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        // Render PDF TextLayer
        if (textLayerRef.current && pdfjsLibRef.current) {
          if (textLayerTaskRef.current) {
            textLayerTaskRef.current.cancel?.();
            textLayerTaskRef.current = null;
          }
          textLayerRef.current.innerHTML = "";
          try {
            const textContent = await page.getTextContent();
            if (textContent.items.length > 0) {
              const textLayer = new pdfjsLibRef.current.TextLayer({
                textContentSource: textContent,
                container: textLayerRef.current,
                viewport,
              });
              textLayerTaskRef.current = textLayer;
              await textLayer.render();
            }
          } catch (textErr: any) {
            if (textErr?.name !== "RenderingCancelledException") {
              console.warn("Text layer render error / scanned page:", textErr);
            }
          }
        }
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.warn("PDF page render warning:", err);
        }
      }
    },
    [scale]
  );

  // Load highlights for current page
  useEffect(() => {
    let active = true;
    async function loadHighlights() {
      try {
        const pageHighlights = await fetchPdfPageHighlights(book.id, currentPage);
        if (active) {
          setHighlights(pageHighlights);
        }
      } catch (err) {
        console.warn("Could not load PDF page highlights:", err);
      }
    }
    loadHighlights();
    setActiveSelection(null);
    setPendingHighlightData(null);
    return () => {
      active = false;
    };
  }, [book.id, currentPage]);

  const handlePageSelectionEnd = useCallback(() => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        return;
      }

      const selText = sel.toString().trim();
      if (!selText || !pageContainerRef.current) {
        return;
      }

      const range = sel.getRangeAt(0);
      if (!pageContainerRef.current.contains(range.commonAncestorContainer)) {
        return;
      }

      const containerRect = pageContainerRef.current.getBoundingClientRect();
      const clientRects = Array.from(range.getClientRects());
      const mergedRects = normalizeAndMergeRects(clientRects, containerRect);

      if (mergedRects.length === 0) {
        return;
      }

      const overallRect = range.getBoundingClientRect();
      setPendingHighlightData({
        rects: mergedRects,
        selectedText: selText,
      });
      setActiveSelection({
        rect: overallRect,
        existingHighlight: null,
      });
    }, 20);
  }, []);

  const handleContainerClick = (e: React.MouseEvent) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
      return;
    }

    if (!pageContainerRef.current) return;
    const containerRect = pageContainerRef.current.getBoundingClientRect();
    const clickX = (e.clientX - containerRect.left) / containerRect.width;
    const clickY = (e.clientY - containerRect.top) / containerRect.height;

    const hitHighlight = highlights.find((h) => {
      const rects = (h.rects as PdfHighlightRect[]) || [];
      return rects.some(
        (r) =>
          clickX >= r.x - 0.005 &&
          clickX <= r.x + r.width + 0.005 &&
          clickY >= r.y - 0.005 &&
          clickY <= r.y + r.height + 0.005
      );
    });

    if (hitHighlight) {
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
        existingHighlight: hitHighlight,
      });
    } else {
      if (activeSelection) {
        setActiveSelection(null);
        setPendingHighlightData(null);
      }
    }
  };

  const handleSelectHighlightColor = async (type: HighlightType) => {
    if (activeSelection?.existingHighlight) {
      const targetId = activeSelection.existingHighlight.id;
      const updated: Highlight = {
        ...activeSelection.existingHighlight,
        type,
      };
      setHighlights((prev) =>
        prev.map((h) => (h.id === targetId ? updated : h))
      );
      setActiveSelection(null);

      try {
        await updatePdfHighlightCategory(targetId, type);
      } catch (err) {
        console.warn("Failed to update highlight category:", err);
      }
    } else if (pendingHighlightData) {
      const { rects, selectedText } = pendingHighlightData;
      const tempId = `temp-${Date.now()}`;
      const tempHighlight: Highlight = {
        id: tempId,
        bookId: book.id,
        pageNumber: currentPage,
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
          pageNumber: currentPage,
          rects,
          selectedText,
          type,
        });
        if (res.ok) {
          setHighlights((prev) =>
            prev.map((h) => (h.id === tempId ? res.highlight : h))
          );
        } else {
          setHighlights((prev) => prev.filter((h) => h.id !== tempId));
        }
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

  useEffect(() => {
    if (!isLoading && pdfDocRef.current) {
      renderPage(currentPage);
      setPageInput(String(currentPage));
    }
  }, [currentPage, scale, isLoading, renderPage]);

  // 6. In-book Content Search (Debounced, pg_trgm powered)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const handler = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/books/${book.id}/search-content?q=${encodeURIComponent(trimmed)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.error("In-book search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [searchQuery, book.id]);

  // 7. Touch / Swipe Event Handlers for Mobile & Tablets (ТЗ §3)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - touchStartRef.current.x;
    const diffY = endY - touchStartRef.current.y;
    const diffTime = Date.now() - touchStartRef.current.time;

    // Detect horizontal swipe gesture
    if (
      diffTime < 600 &&
      Math.abs(diffX) > 45 &&
      Math.abs(diffX) > Math.abs(diffY) * 1.4
    ) {
      if (diffX < 0) {
        // Swipe Left -> Next Page
        setCurrentPage((prev) => Math.min(prev + 1, numPages || prev));
      } else {
        // Swipe Right -> Prev Page
        setCurrentPage((prev) => Math.max(prev - 1, 1));
      }
    }
    touchStartRef.current = null;
  };

  // 8. Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen((prev) => {
          const next = !prev;
          if (next) setTimeout(() => searchInputRef.current?.focus(), 50);
          return next;
        });
        return;
      }

      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        return;
      }

      if (e.target instanceof HTMLInputElement) return;

      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === "j") {
        e.preventDefault();
        setCurrentPage((prev) => Math.min(prev + 1, numPages || prev));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "k") {
        e.preventDefault();
        setCurrentPage((prev) => Math.max(prev - 1, 1));
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setScale((prev) => Math.min(prev + 0.2, 3.0));
      } else if (e.key === "-") {
        e.preventDefault();
        setScale((prev) => Math.max(prev - 0.2, 0.6));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [numPages, searchOpen]);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(pageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= numPages) {
      setCurrentPage(p);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const jumpToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= numPages) {
      setCurrentPage(pageNum);
      if (window.innerWidth < 768) {
        setSearchOpen(false);
      }
    }
  };

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-paper text-ink select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Toast Notification (e.g. "Продолжаем с 14 страницы") */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-paper-soft/95 px-4 py-2 text-xs font-medium text-ink shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2">
          📖 {toastMessage}
        </div>
      )}

      {/* Top Header Controls — unified with EPUB reader */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-paper-soft px-3 sm:px-5 shadow-xs select-none z-20">
        {/* Left: Search Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSearchOpen((prev) => {
                const next = !prev;
                if (next) setTimeout(() => searchInputRef.current?.focus(), 50);
                return next;
              });
            }}
            className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs sm:text-sm font-medium transition-all active:scale-95 ${
              searchOpen
                ? "bg-accent text-paper-soft shadow-xs"
                : "text-ink hover:bg-border/60"
            }`}
            title="Поиск внутри книги (Cmd+F)"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span className="hidden sm:inline">Поиск в книге</span>
          </button>
        </div>

        {/* Center: Title & Author */}
        <div className="flex flex-col items-center justify-center max-w-[42%] sm:max-w-[50%] px-2 text-center truncate">
          <div className="flex items-center gap-2 truncate justify-center max-w-full">
            <h1 className="truncate font-serif text-sm sm:text-base font-medium text-ink">
              {book.title}
            </h1>
            {book.isLinearized && (
              <span
                className="hidden lg:inline-flex items-center rounded-full bg-emerald-800/10 px-2 py-0.5 text-[10px] font-medium text-emerald-800 border border-emerald-700/30"
                title="Fast Web View: потоковая загрузка HTTP 206 Range"
              >
                ⚡ Fast Web View
              </span>
            )}
          </div>
          <span className="w-full truncate text-[11px] text-ink-muted">
            {book.author?.name || "Автор неизвестен"}
          </span>
        </div>

        {/* Right: Page Navigation, Zoom & Return to book */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Page controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage <= 1 || isLoading}
              className="rounded-md p-1.5 text-ink-muted hover:text-ink hover:bg-border/60 active:scale-95 transition-all disabled:opacity-30"
              title="Предыдущая страница (← / свайп вправо)"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <form
              onSubmit={handlePageInputSubmit}
              className="flex items-center gap-1 text-xs text-ink-muted"
            >
              <input
                type="text"
                value={pageInput}
                onChange={handlePageInputChange}
                onBlur={handlePageInputSubmit}
                className="h-7 w-12 rounded border border-border bg-paper text-center font-mono text-xs text-ink focus:border-accent focus:outline-none"
              />
              <span className="text-[11px]">/ {numPages || "…"}</span>
            </form>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, numPages))}
              disabled={currentPage >= numPages || isLoading}
              className="rounded-md p-1.5 text-ink-muted hover:text-ink hover:bg-border/60 active:scale-95 transition-all disabled:opacity-30"
              title="Следующая страница (→ / свайп влево)"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Zoom controls */}
          <div className="hidden items-center gap-1 sm:flex ml-1">
            <button
              onClick={() => setScale((s) => Math.max(s - 0.2, 0.6))}
              className="rounded-md p-1.5 text-ink-muted hover:text-ink hover:bg-border/60 active:scale-95 transition-all"
              title="Уменьшить (-)"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="w-9 text-center font-mono text-xs text-ink-muted">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(s + 0.2, 3.0))}
              className="rounded-md p-1.5 text-ink-muted hover:text-ink hover:bg-border/60 active:scale-95 transition-all"
              title="Увеличить (+)"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <div className="h-4 w-px bg-border mx-0.5" />

          {/* Switch to text reader if available */}
          <Link
            href={`/books/${book.id}/read?mode=text`}
            className="hidden md:flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-ink-muted hover:text-ink hover:bg-border/60 transition-colors"
            title="Переключиться в текстовый режим"
          >
            <svg className="h-3.5 w-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            <span>Текст</span>
          </Link>

          {/* Back to book button */}
          <Link
            href={`/books/${book.id}`}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs sm:text-sm font-medium text-ink-muted hover:text-ink hover:bg-border/60 transition-colors"
            title="Вернуться к информации о книге"
          >
            <span className="hidden md:inline">К книге</span>
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Link>
        </div>
      </header>

      {/* Main Content Area: Search Sidebar + Canvas Viewport */}
      <div className="relative flex flex-1 overflow-hidden bg-paper">
        {/* In-Book Search Drawer (ТЗ §4) */}
        {searchOpen && (
          <aside className="absolute inset-y-0 left-0 z-30 flex w-80 flex-col border-r border-border bg-paper-soft shadow-2xl transition-all">
            <div className="flex items-center justify-between border-b border-border p-3">
              <span className="text-xs font-serif font-medium text-ink">
                Поиск по содержимому книги
              </span>
              <button
                onClick={() => setSearchOpen(false)}
                className="rounded-md p-1 text-ink-muted hover:bg-border/60 hover:text-ink transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-3">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Введите слово или фразу…"
                  className="w-full rounded-md border border-border bg-paper py-2 pl-8 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
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
            </div>

            {/* Results list */}
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {searchQuery.trim().length >= 2 && searchResults.length === 0 && !isSearching && (
                <p className="mt-4 text-center text-xs text-ink-muted">
                  Ничего не найдено в тексте книги
                </p>
              )}

              {searchResults.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-medium text-ink-muted">
                    Найдено совпадений: {searchResults.length}
                  </p>
                  {searchResults.map((res, i) => (
                    <button
                      key={i}
                      onClick={() => jumpToPage(res.pageNumber)}
                      className={`group flex flex-col items-start rounded-lg border p-2.5 text-left transition-colors ${
                        currentPage === res.pageNumber
                          ? "border-accent bg-accent/10"
                          : "border-border bg-paper hover:border-accent/40 hover:bg-paper-soft"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between text-[11px] font-medium text-accent">
                        <span>Страница {res.pageNumber}</span>
                        <span className="text-[10px] text-ink-muted group-hover:text-ink">
                          Перейти →
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-ink line-clamp-2">
                        {res.snippet}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Main Canvas Viewport Area */}
        <main className="relative flex flex-1 items-start justify-center overflow-auto p-4 sm:p-8 bg-paper">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper/90 backdrop-blur-xs z-10 text-ink">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-accent" />
              <p className="font-serif text-sm text-ink">
                Потоковая загрузка PDF (HTTP 206)…
              </p>
              <div className="h-1.5 w-48 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-accent transition-all duration-200"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mx-auto max-w-md rounded-xl border border-red-500/20 bg-red-950/20 p-6 text-center text-red-700">
              <p className="font-medium">Не удалось открыть PDF</p>
              <p className="mt-2 text-xs text-red-600/80">{error}</p>
              <div className="mt-5 flex justify-center gap-3">
                <Link
                  href={`/books/${book.id}/read`}
                  className="rounded-md bg-accent px-4 py-2 text-xs font-medium text-paper-soft transition hover:opacity-90"
                >
                  Открыть в текстовом ридере
                </Link>
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-md border border-border px-4 py-2 text-xs text-ink transition hover:bg-paper-soft"
                >
                  Повторить
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center">
            <div
              ref={pageContainerRef}
              onMouseUp={handlePageSelectionEnd}
              onTouchEnd={handlePageSelectionEnd}
              onClick={handleContainerClick}
              className="relative rounded-xs bg-white shadow-xl border border-border/70 select-text overflow-hidden"
              style={{
                display: isLoading || error ? "none" : "block",
                width: pageDimensions?.width ? `${pageDimensions.width}px` : undefined,
                height: pageDimensions?.height ? `${pageDimensions.height}px` : undefined,
              }}
            >
              <canvas ref={canvasRef} className="block select-none" />
              <div
                ref={textLayerRef}
                className="textLayer absolute inset-0 select-text"
                style={{
                  width: pageDimensions?.width ? `${pageDimensions.width}px` : undefined,
                  height: pageDimensions?.height ? `${pageDimensions.height}px` : undefined,
                  "--scale-factor": scale,
                } as React.CSSProperties}
              />
              {/* Highlights visual overlay */}
              <div className="absolute inset-0 pointer-events-none z-10">
                {highlights.map((h) => {
                  const rects = (h.rects as PdfHighlightRect[]) || [];
                  const bgStyle =
                    (h.type && highlightBgStyles[h.type]) ||
                    "bg-amber-300/45 border-b border-amber-500/50";

                  return (
                    <React.Fragment key={h.id}>
                      {rects.map((r, idx) => (
                        <div
                          key={`${h.id}-${idx}`}
                          className={`absolute rounded-xs pointer-events-none transition-opacity mix-blend-multiply ${bgStyle}`}
                          style={{
                            left: `${r.x * 100}%`,
                            top: `${r.y * 100}%`,
                            width: `${r.width * 100}%`,
                            height: `${r.height * 100}%`,
                          }}
                        />
                      ))}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </main>

        {/* Highlight creation and editing menu */}
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

      {/* Bottom Floating Quick Pagination on Mobile */}
      <div className="flex items-center justify-between border-t border-border bg-paper-soft px-4 py-2 text-xs text-ink-muted sm:hidden">
        <button
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          disabled={currentPage <= 1 || isLoading}
          className="rounded px-3 py-1 bg-border/60 text-ink hover:bg-border active:scale-95 disabled:opacity-30"
        >
          Назад
        </button>
        <span>
          Стр. {currentPage} из {numPages}
        </span>
        <button
          onClick={() => setCurrentPage((p) => Math.min(p + 1, numPages))}
          disabled={currentPage >= numPages || isLoading}
          className="rounded px-3 py-1 bg-border/60 text-ink hover:bg-border active:scale-95 disabled:opacity-30"
        >
          Вперед
        </button>
      </div>
    </div>
  );
}
