import React, { useEffect } from "react";
import type { EpubTheme, EpubTocItem } from "./types";

interface EpubTocPanelProps {
  isOpen: boolean;
  items: EpubTocItem[];
  theme?: EpubTheme;
  onClose: () => void;
  onNavigate: (href: string) => void;
}

const tocThemeClasses: Record<
  EpubTheme,
  {
    drawer: string;
    header: string;
    title: string;
    item: string;
    subitemBorder: string;
    closeBtn: string;
    emptyText: string;
    backdrop: string;
  }
> = {
  paper: {
    drawer: "bg-[#faf8f5] border-[#e7e5e4] text-[#1c1917]",
    header: "bg-[#f5f2eb] border-[#e7e5e4]",
    title: "text-[#1c1917]",
    item: "text-[#1c1917] hover:bg-[#eae6dd] hover:text-[#7a2e3a]",
    subitemBorder: "border-[#e7e5e4]",
    closeBtn: "text-[#78716c] hover:text-[#1c1917] hover:bg-[#e7e5e4]",
    emptyText: "text-[#78716c]",
    backdrop: "bg-[#1c1917]/25",
  },
  sepia: {
    drawer: "bg-[#f4ecd8] border-[#dfd1b5] text-[#382a18]",
    header: "bg-[#ebe0c5] border-[#dfd1b5]",
    title: "text-[#382a18]",
    item: "text-[#382a18] hover:bg-[#e2d5b6] hover:text-[#6d281a]",
    subitemBorder: "border-[#dfd1b5]",
    closeBtn: "text-[#7d674c] hover:text-[#382a18] hover:bg-[#dfd1b5]",
    emptyText: "text-[#7d674c]",
    backdrop: "bg-[#382a18]/25",
  },
  dark: {
    drawer: "bg-[#18181b] border-[#27272a] text-[#e4e4e7]",
    header: "bg-[#202023] border-[#27272a]",
    title: "text-[#e4e4e7]",
    item: "text-[#e4e4e7] hover:bg-[#27272a] hover:text-[#ffffff]",
    subitemBorder: "border-[#27272a]",
    closeBtn: "text-[#a1a1aa] hover:text-[#ffffff] hover:bg-[#27272a]",
    emptyText: "text-[#a1a1aa]",
    backdrop: "bg-black/60",
  },
};

function TocItemNode({
  item,
  depth = 0,
  themeClass,
  onNavigate,
}: {
  item: EpubTocItem;
  depth?: number;
  themeClass: { item: string; subitemBorder: string };
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
        className={`w-full text-left py-2 px-3 rounded-md text-sm ${themeClass.item} transition-colors flex items-center justify-between group`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <span className="truncate font-medium group-hover:underline">
          {item.label?.trim() || "Без названия"}
        </span>
      </button>

      {hasSubitems && (
        <div className={`flex flex-col border-l ${themeClass.subitemBorder} ml-4 pl-1`}>
          {item.subitems!.map((sub, idx) => (
            <TocItemNode
              key={`${sub.href || ""}-${idx}`}
              item={sub}
              depth={depth + 1}
              themeClass={themeClass}
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
  theme = "paper",
  onClose,
  onNavigate,
}: EpubTocPanelProps) {
  const tc = tocThemeClasses[theme] || tocThemeClasses.paper;

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
          className={`fixed inset-0 z-40 ${tc.backdrop} backdrop-blur-[2px] transition-opacity duration-300`}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] ${tc.drawer} border-r shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Оглавление"
      >
        {/* Drawer Header */}
        <div className={`flex h-14 shrink-0 items-center justify-between border-b px-4 ${tc.header}`}>
          <h2 className={`font-serif text-base font-semibold ${tc.title}`}>
            Оглавление
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-md p-1.5 transition-colors ${tc.closeBtn}`}
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
                themeClass={tc}
                onNavigate={onNavigate}
              />
            ))
          ) : (
            <div className={`py-12 text-center text-sm ${tc.emptyText}`}>
              Оглавление загружается или отсутствует
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
