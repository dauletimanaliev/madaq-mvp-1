"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { EpubTheme } from "./types";

interface EpubTopBarProps {
  title: string;
  bookId: string;
  currentLabel?: string | null;
  theme: EpubTheme;
  fontSize: number;
  onThemeChange: (theme: EpubTheme) => void;
  onFontSizeChange: (fontSize: number) => void;
  onToggleToc: () => void;
  onPrev: () => void;
  onNext: () => void;
}

const topBarThemeClasses: Record<
  EpubTheme,
  {
    header: string;
    text: string;
    muted: string;
    hoverBtn: string;
    popover: string;
    stepperBox: string;
    divider: string;
    aaActive: string;
  }
> = {
  paper: {
    header: "bg-[#ffffff] border-[#e7e5e4] text-[#1c1917]",
    text: "text-[#1c1917]",
    muted: "text-[#78716c]",
    hoverBtn: "hover:bg-[#e7e5e4] text-[#1c1917]",
    popover: "bg-[#ffffff] border-[#e7e5e4] text-[#1c1917]",
    stepperBox: "bg-[#ffffff] border-[#e7e5e4] text-[#1c1917]",
    divider: "bg-[#e7e5e4]",
    aaActive: "bg-[#e7e5e4] text-[#1c1917]",
  },
  sepia: {
    header: "bg-[#f4ecd8] border-[#e2d5bc] text-[#382a18]",
    text: "text-[#382a18]",
    muted: "text-[#7d674c]",
    hoverBtn: "hover:bg-[#e6d9be] text-[#382a18]",
    popover: "bg-[#f4ecd8] border-[#dfd1b5] text-[#382a18]",
    stepperBox: "bg-[#fcf8ef] border-[#dfd1b5] text-[#382a18]",
    divider: "bg-[#dfd1b5]",
    aaActive: "bg-[#dfd1b5] text-[#382a18]",
  },
  dark: {
    header: "bg-[#18181b] border-[#27272a] text-[#e4e4e7]",
    text: "text-[#e4e4e7]",
    muted: "text-[#a1a1aa]",
    hoverBtn: "hover:bg-[#27272a] text-[#e4e4e7]",
    popover: "bg-[#242427] border-[#3f3f46] text-[#e4e4e7]",
    stepperBox: "bg-[#18181b] border-[#3f3f46] text-[#e4e4e7]",
    divider: "bg-[#27272a]",
    aaActive: "bg-[#3f3f46] text-[#ffffff]",
  },
};

export function EpubTopBar({
  title,
  bookId,
  currentLabel,
  theme,
  fontSize,
  onThemeChange,
  onFontSizeChange,
  onToggleToc,
  onPrev,
  onNext,
}: EpubTopBarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const tc = topBarThemeClasses[theme] || topBarThemeClasses.paper;

  // Close settings popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target as Node)
      ) {
        setSettingsOpen(false);
      }
    }
    if (settingsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [settingsOpen]);

  return (
    <header
      className={`flex h-14 shrink-0 items-center justify-between border-b ${tc.header} px-3 sm:px-5 select-none z-20 transition-colors duration-200`}
    >
      {/* Left: Table of contents button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleToc}
          className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs sm:text-sm font-medium ${tc.text} ${tc.hoverBtn} active:scale-95 transition-all`}
          title="Открыть оглавление"
        >
          <svg
            className={`h-4 w-4 ${tc.muted}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h7"
            />
          </svg>
          <span className="hidden sm:inline">Оглавление</span>
        </button>
      </div>

      {/* Center: Title & Current Section */}
      <div className="flex flex-col items-center justify-center max-w-[40%] sm:max-w-[50%] px-2 text-center truncate">
        <h1 className={`w-full truncate font-serif text-sm sm:text-base font-medium ${tc.text}`}>
          {title}
        </h1>
        {currentLabel && (
          <span className={`w-full truncate text-[11px] ${tc.muted}`}>
            {currentLabel}
          </span>
        )}
      </div>

      {/* Right: Settings (Aa), Navigation & Close */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Settings button ("Aa") */}
        <div className="relative" ref={settingsRef}>
          <button
            id="epub-settings-toggle"
            type="button"
            onClick={() => setSettingsOpen((prev) => !prev)}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs sm:text-sm font-serif font-bold transition-all active:scale-95 ${
              settingsOpen ? tc.aaActive : `${tc.text} ${tc.hoverBtn}`
            }`}
            title="Настройки шрифта и темы"
            aria-expanded={settingsOpen}
          >
            <span>Аа</span>
          </button>

          {/* Settings Popover */}
          {settingsOpen && (
            <div
              className={`absolute right-0 top-full mt-2 w-64 rounded-xl border p-3.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 z-50 ${tc.popover}`}
            >
              <div className={`text-[11px] font-medium uppercase tracking-wider ${tc.muted} mb-2.5`}>
                Размер шрифта
              </div>
              <div className={`flex items-center justify-between rounded-lg border p-1 mb-4 ${tc.stepperBox}`}>
                <button
                  id="font-size-decrease-btn"
                  type="button"
                  onClick={() => onFontSizeChange(Math.max(70, fontSize - 10))}
                  disabled={fontSize <= 70}
                  className={`flex h-8 w-10 items-center justify-center rounded text-xs font-bold ${tc.text} ${tc.hoverBtn} active:scale-90 disabled:opacity-30 transition-all`}
                  title="Уменьшить шрифт"
                >
                  А-
                </button>
                <span className="font-mono text-xs font-medium">
                  {fontSize}%
                </span>
                <button
                  id="font-size-increase-btn"
                  type="button"
                  onClick={() => onFontSizeChange(Math.min(160, fontSize + 10))}
                  disabled={fontSize >= 160}
                  className={`flex h-8 w-10 items-center justify-center rounded text-sm font-bold ${tc.text} ${tc.hoverBtn} active:scale-90 disabled:opacity-30 transition-all`}
                  title="Увеличить шрифт"
                >
                  А+
                </button>
              </div>

              <div className={`text-[11px] font-medium uppercase tracking-wider ${tc.muted} mb-2.5`}>
                Тема оформления
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  id="theme-paper-btn"
                  type="button"
                  onClick={() => onThemeChange("paper")}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 text-[11px] font-medium transition-all ${
                    theme === "paper"
                      ? "border-amber-600 ring-2 ring-amber-600/30 bg-[#ffffff] text-[#1c1917] font-bold"
                      : "border-black/10 bg-[#ffffff] text-[#1c1917] opacity-80 hover:opacity-100"
                  }`}
                >
                  <span className="h-4 w-4 rounded-full border border-black/10 bg-[#ffffff]" />
                  Бумага
                </button>

                <button
                  id="theme-sepia-btn"
                  type="button"
                  onClick={() => onThemeChange("sepia")}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 text-[11px] font-medium transition-all ${
                    theme === "sepia"
                      ? "border-amber-700 ring-2 ring-amber-700/30 bg-[#f4ecd8] text-[#382a18] font-bold"
                      : "border-amber-900/15 bg-[#f4ecd8] text-[#382a18] opacity-80 hover:opacity-100"
                  }`}
                >
                  <span className="h-4 w-4 rounded-full border border-amber-900/20 bg-[#f4ecd8]" />
                  Сепия
                </button>

                <button
                  id="theme-dark-btn"
                  type="button"
                  onClick={() => onThemeChange("dark")}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 text-[11px] font-medium transition-all ${
                    theme === "dark"
                      ? "border-amber-500 ring-2 ring-amber-500/30 bg-[#18181b] text-[#e4e4e7] font-bold"
                      : "border-white/10 bg-[#18181b] text-[#e4e4e7] opacity-80 hover:opacity-100"
                  }`}
                >
                  <span className="h-4 w-4 rounded-full border border-white/20 bg-[#18181b]" />
                  Тёмная
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={`h-4 w-px ${tc.divider} mx-0.5`} />

        {/* Prev / Next buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            className={`rounded-md p-1.5 ${tc.muted} hover:${tc.text} ${tc.hoverBtn} active:scale-95 transition-all`}
            title="Предыдущая страница (←)"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={onNext}
            className={`rounded-md p-1.5 ${tc.muted} hover:${tc.text} ${tc.hoverBtn} active:scale-95 transition-all`}
            title="Следующая страница (→)"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        <div className={`h-4 w-px ${tc.divider} mx-0.5`} />

        {/* Back to book button */}
        <Link
          href={`/books/${bookId}`}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs sm:text-sm font-medium ${tc.muted} hover:${tc.text} ${tc.hoverBtn} transition-colors`}
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </Link>
      </div>
    </header>
  );
}

