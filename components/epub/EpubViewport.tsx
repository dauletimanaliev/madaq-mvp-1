"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { EpubTocItem, EpubViewportHandle } from "./types";

interface EpubViewportProps {
  bookId: string;
  onTocLoaded: (items: EpubTocItem[]) => void;
  onRelocate: (label: string | null) => void;
}

export const EpubViewport = forwardRef<EpubViewportHandle, EpubViewportProps>(
  function EpubViewport({ bookId, onTocLoaded, onRelocate }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<any>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        goTo: (href: string) => {
          if (viewRef.current?.goTo) {
            viewRef.current.goTo(href).catch((err: any) => {
              console.error("Failed to navigate to", href, err);
            });
          }
        },
        next: () => {
          if (viewRef.current?.next) {
            viewRef.current.next().catch((err: any) => {
              console.error("Failed to go to next page", err);
            });
          }
        },
        prev: () => {
          if (viewRef.current?.prev) {
            viewRef.current.prev().catch((err: any) => {
              console.error("Failed to go to prev page", err);
            });
          }
        },
      }),
      []
    );

    useEffect(() => {
      let cancelled = false;
      let activeView: any = null;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (!viewRef.current) return;
        if (e.key === "ArrowLeft") {
          viewRef.current.prev?.();
        } else if (e.key === "ArrowRight") {
          viewRef.current.next?.();
        }
      };

      async function initReader() {
        try {
          setIsLoading(true);
          setError(null);

          // 1. Dynamic import of foliate-js view
          // @ts-ignore - native browser ES module served from public/foliate-js
          await import(/* webpackIgnore: true */ "/foliate-js/view.js");
          if (cancelled) return;

          // 2. Create <foliate-view> custom element
          const view = document.createElement("foliate-view") as any;
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
          const fileRes = await fetch(url);
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

          // 6. Open book
          await view.open(file);
          if (cancelled) {
            view.close?.();
            view.remove();
            return;
          }

          viewRef.current = view;

          // 7. Pass TOC to parent shell
          if (view.book?.toc) {
            onTocLoaded(view.book.toc);
          }

          // 8. Style book content to match Madaq warm palette
          if (view.renderer?.setStyles) {
            view.renderer.setStyles(`
              html {
                color-scheme: light;
                background-color: #efe6d3;
                color: #211d16;
              }
              body {
                background-color: #efe6d3;
                color: #211d16;
                font-family: var(--font-lora, Georgia, serif);
                line-height: 1.65;
              }
              p, li, blockquote, dd {
                line-height: 1.65;
              }
              a {
                color: #7a2e3a;
                text-decoration: underline;
              }
            `);
          }

          // 9. Position restore via localStorage
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

          if (cancelled) {
            view.close?.();
            view.remove();
            return;
          }

          // 10. Relocate listener to save CFI and report progress
          const handleRelocate = (e: any) => {
            const detail = e.detail;
            if (detail?.cfi) {
              try {
                localStorage.setItem(`epub-cfi:${bookId}`, detail.cfi);
              } catch (err) {
                console.warn("Failed to persist CFI", err);
              }
            }

            if (detail?.tocItem?.label) {
              onRelocate(detail.tocItem.label);
            } else if (typeof detail?.fraction === "number") {
              const pct = Math.round(detail.fraction * 100);
              onRelocate(`${pct}%`);
            }
          };

          view.addEventListener("relocate", handleRelocate);

          // Keyboard listeners
          window.addEventListener("keydown", handleKeyDown);
          view.addEventListener("load", ({ detail }: any) => {
            try {
              detail?.doc?.addEventListener("keydown", handleKeyDown);
            } catch (err) {
              // ignore
            }
          });

          setIsLoading(false);
        } catch (err: any) {
          if (!cancelled) {
            console.error("EPUB initialization failed:", err);
            setError(
              err.message ||
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
    }, [bookId, onTocLoaded, onRelocate]);

    return (
      <div className="relative flex-1 w-full h-full bg-paper overflow-hidden">
        {/* Loading overlay */}
        {isLoading && !error && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-paper/90 backdrop-blur-xs">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="mt-4 text-sm font-medium text-ink-muted">
              Загрузка книги...
            </p>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-paper">
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
      </div>
    );
  }
);
