"use client";

import React, { useRef, useState, useCallback } from "react";
import { EpubTopBar } from "./EpubTopBar";
import { EpubTocPanel } from "./EpubTocPanel";
import { EpubViewport } from "./EpubViewport";
import type { EpubTocItem, EpubViewportHandle } from "./types";

interface EpubReaderShellProps {
  bookId: string;
  title: string;
}

export function EpubReaderShell({ bookId, title }: EpubReaderShellProps) {
  const [tocOpen, setTocOpen] = useState<boolean>(false);
  const [tocItems, setTocItems] = useState<EpubTocItem[]>([]);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper text-ink overflow-hidden">
      <EpubTopBar
        title={title}
        bookId={bookId}
        currentLabel={currentLabel}
        onToggleToc={handleToggleToc}
        onPrev={handlePrev}
        onNext={handleNext}
      />
      <EpubTocPanel
        isOpen={tocOpen}
        items={tocItems}
        onClose={handleCloseToc}
        onNavigate={handleNavigate}
      />
      <EpubViewport
        ref={viewportRef}
        bookId={bookId}
        onTocLoaded={handleTocLoaded}
        onRelocate={handleRelocate}
      />
    </div>
  );
}
