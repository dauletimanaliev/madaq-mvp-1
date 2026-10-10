import React, { useEffect } from "react";
import type { EpubTocItem } from "./types";

interface EpubTocPanelProps {
  isOpen: boolean;
  items: EpubTocItem[];
  onClose: () => void;
  onNavigate: (href: string) => void;
}

function TocItemNode({
  item,
  depth = 0,
  onNavigate,
}: {
  item: EpubTocItem;
  depth?: number;
  onNavigate: (href: string) => void;
}) {
  const hasSubitems = Array.isArray(item.subitems) && item.subitems.length > 0;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => {
          if (item.href) {
            onNavigate(item.href);
          }
        }}
        className="w-full text-left py-2 px-3 rounded-md text-sm text-ink hover:bg-paper-soft hover:text-accent transition-colors flex items-center justify-between group"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <span className="truncate font-medium group-hover:underline">
          {item.label?.trim() || "Без названия"}
        </span>
      </button>

      {hasSubitems && (
        <div className="flex flex-col border-l border-border/70 ml-4 pl-1">
          {item.subitems!.map((sub, idx) => (
            <TocItemNode
              key={`${sub.href || ""}-${idx}`}
              item={sub}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function EpubTocPanel({
  isOpen,
  items,
  onClose,
  onNavigate,
}: EpubTocPanelProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-paper border-r border-border shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Оглавление"
      >
        {/* Drawer Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-paper-soft px-4">
          <h2 className="font-serif text-base font-semibold text-ink">
            Оглавление
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-muted hover:text-ink hover:bg-border/60 transition-colors"
            title="Закрыть оглавление"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {items && items.length > 0 ? (
            items.map((item, index) => (
              <TocItemNode
                key={`${item.href || ""}-${index}`}
                item={item}
                depth={0}
                onNavigate={onNavigate}
              />
            ))
          ) : (
            <div className="py-12 text-center text-sm text-ink-muted">
              В этой книге нет структурированного оглавления
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
