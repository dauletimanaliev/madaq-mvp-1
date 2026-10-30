"use client";

import React, { useRef, useState, useCallback, useSyncExternalStore } from "react";
import { EpubTopBar } from "./EpubTopBar";
import { EpubTocPanel } from "./EpubTocPanel";
import { EpubViewport } from "./EpubViewport";
import { ReaderProgress } from "@/components/reader/ReaderProgress";
import type { EpubTheme, EpubTocItem, EpubViewportHandle } from "./types";

interface EpubReaderShellProps {
  bookId: string;
  title: string;
  isMobile?: boolean;
  initialTheme?: EpubTheme;
}

const subscribeMount = (onStoreChange: () => void) => {
  onStoreChange();
  return () => {};
};

function useMounted() {
  return useSyncExternalStore(
    subscribeMount,
    () => true,
    () => false
  );
}

function EpubReaderContent({ bookId, title, isMobile, initialTheme }: EpubReaderShellProps) {
  const [tocOpen, setTocOpen] = useState<boolean>(false);
  const [tocItems, setTocItems] = useState<EpubTocItem[]>([]);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ page: number; total: number } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show the page tracker and save progress to the library (debounced).
  const handleProgress = useCallback(
    (page: number, total: number) => {
      setProgress((prev) => (prev?.page === page && prev.total === total ? prev : { page, total }));
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        fetch(`/api/books/${bookId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page, totalPages: total }),
        }).catch(() => {});
      }, 1000);
    },
    [bookId]
  );

  // Initialize theme & font size from localStorage once mounted on client
  const [theme, setTheme] = useState<EpubTheme>(() => {
    if (initialTheme) return initialTheme;
    try {
      const saved = localStorage.getItem("madaq_epub_theme");
      if (saved === "paper" || saved === "sepia" || saved === "dark") {
        return saved;
      }
    } catch {}
    return "paper";
  });

  const [fontSize, setFontSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("madaq_epub_fontsize");
      if (saved) {
        const num = parseInt(saved, 10);
        if (!isNaN(num) && num >= 70 && num <= 160) {
          return num;
        }
      }
    } catch {}
    return 100;
  });

  const viewportRef = useRef<EpubViewportHandle | null>(null);

  const handleTocLoaded = useCallback((items: EpubTocItem[]) => {
    setTocItems(items);
  }, []);

  const handleRelocate = useCallback((label: string | null) => {
    setCurrentLabel(label);
  }, []);

  const handleToggleToc = useCallback(() => {
    setTocOpen((prev) => !prev);
  }, []);

  const handleCloseToc = useCallback(() => {
    setTocOpen(false);
  }, []);

  const handleNavigate = useCallback((href: string) => {
    viewportRef.current?.goTo(href);
    setTocOpen(false);
  }, []);

  const handlePrev = useCallback(() => {
    viewportRef.current?.prev();
  }, []);

  const handleNext = useCallback(() => {
    viewportRef.current?.next();
  }, []);

  const handleThemeChange = useCallback((newTheme: EpubTheme) => {
    setTheme(newTheme);
    try {
      localStorage.setItem("madaq_epub_theme", newTheme);
    } catch (e) {
      console.warn("Failed to save epub theme preference", e);
    }
  }, []);

  const handleFontSizeChange = useCallback((newSize: number) => {
    setFontSize(newSize);
    try {
      localStorage.setItem("madaq_epub_fontsize", String(newSize));
    } catch (e) {
      console.warn("Failed to save epub font size preference", e);
    }
  }, []);

  const isMobileSim = process.env.NODE_ENV !== "production" && Boolean(isMobile);
  const progressTone = theme === "dark" ? "dark" : theme === "sepia" ? "sepia" : "light";

  const shellBg =
    theme === "dark"
      ? "bg-[#18181b] text-[#e4e4e7]"
      : theme === "sepia"
      ? "bg-[#f4ecd8] text-[#382a18]"
      : "bg-[#ffffff] text-[#1c1917]";

  if (isMobileSim) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-0 sm:p-4">
        <div
          style={{ width: "390px", height: "844px" }}
          className={`relative flex flex-col ${shellBg} overflow-hidden shadow-2xl border border-stone-700/40 rounded-none sm:rounded-2xl transition-colors duration-200`}
        >
          <EpubTopBar
            title={title}
            bookId={bookId}
            currentLabel={currentLabel}
            theme={theme}
            fontSize={fontSize}
            onThemeChange={handleThemeChange}
            onFontSizeChange={handleFontSizeChange}
            onToggleToc={handleToggleToc}
            onPrev={handlePrev}
            onNext={handleNext}
          />
          <EpubTocPanel
            isOpen={tocOpen}
            items={tocItems}
            currentLabel={currentLabel}
            theme={theme}
            onClose={handleCloseToc}
            onNavigate={handleNavigate}
          />
          <EpubViewport
            ref={viewportRef}
            bookId={bookId}
            theme={theme}
            fontSize={fontSize}
            isMobile={isMobile}
            onTocLoaded={handleTocLoaded}
            onRelocate={handleRelocate}
            onProgress={handleProgress}
          />
          {progress && (
            <ReaderProgress page={progress.page} total={progress.total} tone={progressTone} className="shrink-0" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col ${shellBg} overflow-hidden transition-colors duration-200`}
    >
      <EpubTopBar
        title={title}
        bookId={bookId}
        currentLabel={currentLabel}
        theme={theme}
        fontSize={fontSize}
        onThemeChange={handleThemeChange}
        onFontSizeChange={handleFontSizeChange}
        onToggleToc={handleToggleToc}
        onPrev={handlePrev}
        onNext={handleNext}
      />
      <EpubTocPanel
        isOpen={tocOpen}
        items={tocItems}
        currentLabel={currentLabel}
        theme={theme}
        onClose={handleCloseToc}
        onNavigate={handleNavigate}
      />
      <EpubViewport
        ref={viewportRef}
        bookId={bookId}
        theme={theme}
        fontSize={fontSize}
        isMobile={isMobile}
        onTocLoaded={handleTocLoaded}
        onRelocate={handleRelocate}
        onProgress={handleProgress}
      />
      {progress && (
        <ReaderProgress page={progress.page} total={progress.total} tone={progressTone} className="shrink-0" />
      )}
    </div>
  );
}

export function EpubReaderShell(props: EpubReaderShellProps) {
  const mounted = useMounted();

  if (!mounted) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#ffffff] text-[#1c1917] overflow-hidden">
        <header className="flex h-14 w-full items-center justify-between border-b border-stone-200/80 px-4 bg-[#ffffff]">
          <div className="flex items-center gap-3">
            <div className="h-4 w-24 rounded bg-stone-200/60" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-12 rounded bg-stone-200/60" />
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="h-6 w-32 animate-pulse rounded bg-stone-200/60" />
        </div>
      </div>
    );
  }

  return <EpubReaderContent {...props} />;
}
