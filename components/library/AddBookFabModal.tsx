"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { getBookReaderUrl } from "@/lib/books/reader-url";
import { MAX_UPLOAD_MB, uploadExtension } from "@/lib/books/upload-limits";

export function openAddBookModal() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-add-book-modal"));
  }
}

type UploadState =
  | { status: "idle" }
  | { status: "dragging" }
  | {
      status: "uploading";
      fileName: string;
      step: number;
      stepText: string;
    }
  | {
      status: "done";
      bookId: string;
      title: string;
      author: string;
      chaptersCount: number;
      coverUrl?: string | null;
      contentFormat?: string | null;
      isScanned?: boolean;
    }
  | { status: "error"; message: string; needsLogin?: boolean };

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/epub+zip",
  "text/plain",
  "text/markdown",
  "application/json",
];
const MAX_SIZE_MB = MAX_UPLOAD_MB;

export function AddBookFabModal() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Allow triggering modal from external buttons (e.g. mobile center nav button)
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-add-book-modal", handleOpen);
    return () => window.removeEventListener("open-add-book-modal", handleOpen);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const isValidFile = useCallback((file: File) => {
    if (uploadExtension(file.name)) return true;
    return Boolean(file.type && ACCEPTED_TYPES.includes(file.type));
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!rightsConfirmed) {
        setState({
          status: "error",
          message: "Сначала отметьте, что у вас есть право загружать этот файл.",
        });
        return;
      }
      if (!isValidFile(file)) {
        setState({
          status: "error",
          message: "Поддерживаемые форматы: PDF, EPUB, TXT, MD, JSON",
        });
        return;
      }

      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setState({
          status: "error",
          message: `Файл слишком большой (макс. ${MAX_SIZE_MB} МБ)`,
        });
        return;
      }

      setState({
        status: "uploading",
        fileName: file.name,
        step: 1,
        stepText: "Загружаем файл…",
      });

      const timer1 = setTimeout(() => {
        setState((prev) =>
          prev.status === "uploading"
            ? {
                ...prev,
                step: 2,
                stepText: "Подготавливаем текст и главы…",
              }
            : prev
        );
      }, 1800);

      try {
        let uploadPayload: BodyInit = new FormData();
        let uploadHeaders: Record<string, string> = {};

        // Direct signed upload to Supabase Storage (bypasses Vercel 4.5MB payload limit completely)
        let signedSuccess = false;
        let uploadErrorMsg: string | null = null;

        try {
          const signRes = await fetch("/api/books/upload/sign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              fileSize: file.size,
              rightsConfirmed: true,
            }),
          });

          // The server refused (not signed in, limit, size, format): show why.
          if (signRes.status >= 400 && signRes.status < 500) {
            const err = (await signRes.json().catch(() => ({}))) as { error?: string };
            clearTimeout(timer1);
            setState({
              status: "error",
              message: err.error || "Не удалось загрузить книгу.",
              needsLogin: signRes.status === 401,
            });
            return;
          }

          if (signRes.ok) {
            const signData = (await signRes.json()) as {
              uploadUrl?: string;
              storagePath?: string;
            };

            if (signData.uploadUrl && signData.storagePath) {
              const uploadFormData = new FormData();
              uploadFormData.append("", file, file.name);

              const directRes = await fetch(signData.uploadUrl, {
                method: "PUT",
                body: uploadFormData,
              });

              if (directRes.ok) {
                signedSuccess = true;
                uploadPayload = JSON.stringify({
                  storagePath: signData.storagePath,
                  fileName: file.name,
                  rightsConfirmed: true,
                });
                uploadHeaders = { "Content-Type": "application/json" };
              } else {
                uploadErrorMsg = `Ошибка загрузки в хранилище (${directRes.status})`;
              }
            }
          } else {
            uploadErrorMsg = `Не удалось подготовить загрузку (${signRes.status})`;
          }
        } catch (signErr) {
          console.warn("Signed upload error:", signErr);
        }

        if (!signedSuccess) {
          if (file.size > 4.5 * 1024 * 1024) {
            clearTimeout(timer1);
            setState({
              status: "error",
              message: uploadErrorMsg || "Не удалось загрузить файл в хранилище. Попробуйте ещё раз.",
            });
            return;
          }
          const formData = new FormData();
          formData.append("file", file);
          formData.append("rightsConfirmed", "true");
          uploadPayload = formData;
        }

        const response = await fetch("/api/books/upload", {
          method: "POST",
          headers: uploadHeaders,
          body: uploadPayload,
        });

        clearTimeout(timer1);

        const resText = await response.text();
        let data: {
          error?: string;
          bookId?: string;
          title?: string;
          author?: string;
          chaptersCount?: number;
          coverUrl?: string | null;
          contentFormat?: string | null;
          isScanned?: boolean;
        } = {};
        try {
          data = JSON.parse(resText);
        } catch {
          data = {
            error: response.ok
              ? "Не удалось обработать ответ сервера."
              : `Ошибка сервера (${response.status}). Попробуйте ещё раз.`,
          };
        }

        if (!response.ok || !data.bookId) {
          setState({
            status: "error",
            message: data.error || "Не удалось загрузить книгу. Попробуйте ещё раз.",
            needsLogin: response.status === 401,
          });
          return;
        }

        setState({
          status: "done",
          bookId: data.bookId,
          title: data.title || "Без названия",
          author: data.author || "Неизвестный автор",
          chaptersCount: data.chaptersCount || 0,
          coverUrl: data.coverUrl,
          contentFormat:
            data.contentFormat ||
            (file.name.toLowerCase().endsWith(".epub")
              ? "EPUB"
              : file.name.toLowerCase().endsWith(".pdf")
              ? "PDF"
              : "TEXT"),
          isScanned: data.isScanned,
        });

        // Automatically refresh library in background so the book is there immediately
        router.refresh();
      } catch (err) {
        clearTimeout(timer1);
        setState({
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "Не удалось загрузить файл. Попробуйте ещё раз.",
        });
      }
    },
    [isValidFile, router, rightsConfirmed]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState((prev) =>
      prev.status === "idle" || prev.status === "dragging" || prev.status === "error"
        ? { status: "dragging" }
        : prev
    );
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState((prev) => (prev.status === "dragging" ? { status: "idle" } : prev));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      e.target.value = "";
    },
    [uploadFile]
  );

  const closeModal = useCallback(() => {
    setIsOpen(false);
    if (state.status === "done" || state.status === "error") {
      setState({ status: "idle" });
      router.refresh();
    }
  }, [state.status, router]);

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  const resetUpload = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const isReaderPage =
    pathname?.includes("/read") ||
    pathname?.includes("/epub") ||
    pathname?.includes("/pdf");
  if (isReaderPage) {
    return null;
  }
  const isLibraryPage = pathname === "/";

  return (
    <>
      {/* ─── Desktop-only Flutter-style Floating Action Button in the Right Corner ─── */}
      {/* (Web version is completely untouched: stays in bottom-right corner at 36px, hidden on mobile) */}
      {isLibraryPage && (
        <div
          className="hidden md:flex flex-row-reverse items-center gap-3"
          style={{
            position: "fixed",
            bottom: "36px",
            right: "36px",
            zIndex: 9999,
          }}
        >
          <button
            id="add-book-fab"
            type="button"
            onClick={openModal}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            aria-label="Добавить книгу"
            title="Добавить книгу"
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "var(--accent, #7a2e3a)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 25px -3px rgba(122, 46, 58, 0.45), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
              cursor: "pointer",
              border: "none",
              outline: "none",
              transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease",
              transform: isHovered ? "scale(1.08)" : "scale(1)",
            }}
          >
            {/* Plus icon */}
            <svg
              style={{
                width: "28px",
                height: "28px",
                transition: "transform 0.25s ease",
                transform: isHovered ? "rotate(90deg)" : "rotate(0deg)",
              }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>

          {/* Flutter-style hover pill tooltip on the left of the button */}
          <div
            style={{
              pointerEvents: "none",
              borderRadius: "9999px",
              backgroundColor: "var(--ink, #211d16)",
              color: "var(--paper, #ffffff)",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              transition: "opacity 0.2s ease, transform 0.2s ease",
              opacity: isHovered ? 1 : 0,
              transform: isHovered ? "translateX(0)" : "translateX(8px)",
            }}
          >
            Добавить книгу
          </div>
        </div>
      )}

      {/* ─── Dialog / Modal ─── */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-paper p-6 shadow-2xl sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/60">
              <div>
                <h2 className="font-serif text-2xl font-bold text-ink">
                  Добавить книгу
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Выберите файл книги на вашем устройстве
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper-soft text-ink-muted transition-colors hover:bg-ink/10 hover:text-ink focus:outline-none"
                aria-label="Закрыть"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content Body */}
            <div className="mt-6">
              {/* State: DONE */}
              {state.status === "done" && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 backdrop-blur-sm">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                    {state.coverUrl ? (
                      <div className="relative h-44 w-32 shrink-0 overflow-hidden rounded-xl shadow-lg border border-border/50 bg-paper">
                        <Image
                          src={state.coverUrl}
                          alt={state.title}
                          width={128}
                          height={176}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-44 w-32 shrink-0 items-center justify-center rounded-xl bg-accent-soft/30 border border-border/50 text-accent">
                        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>
                      </div>
                    )}

                    <div className="flex-1 text-center sm:text-left">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Книга добавлена в библиотеку
                      </div>

                      <h3 className="mt-3 text-lg font-bold text-ink leading-snug">
                        «{state.title}»
                      </h3>
                      <p className="mt-1 text-sm font-medium text-ink-muted">
                        {state.author}
                      </p>
                      {state.isScanned ? (
                        <p className="mt-2 text-xs text-ink-muted">
                          Это скан: страницы откроются как в оригинале, но поиск и выделение текста недоступны.
                        </p>
                      ) : state.contentFormat === "TEXT" && state.chaptersCount > 0 ? (
                        <p className="mt-2 text-xs text-ink-muted">
                          {state.chaptersCount}{" "}
                          {state.chaptersCount % 10 === 1 && state.chaptersCount % 100 !== 11
                            ? "глава"
                            : [2, 3, 4].includes(state.chaptersCount % 10) &&
                              ![12, 13, 14].includes(state.chaptersCount % 100)
                            ? "главы"
                            : "глав"}
                        </p>
                      ) : null}

                      <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            closeModal();
                            router.push(
                              getBookReaderUrl({
                                id: state.bookId,
                                contentFormat: state.contentFormat,
                              })
                            );
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 active:scale-95 transition-all"
                        >
                          <span>Начать читать</span>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={resetUpload}
                          className="rounded-xl border border-border bg-paper px-4 py-2 text-xs font-medium text-ink-muted hover:text-ink hover:border-ink/30 active:scale-95 transition-all"
                        >
                          Добавить ещё
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* State: UPLOADING */}
              {state.status === "uploading" && (
                <div className="rounded-2xl border-2 border-dashed border-accent/40 bg-accent-soft/20 p-8 text-center transition-all">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
                    <div className="h-7 w-7 animate-spin rounded-full border-3 border-accent/30 border-t-accent" />
                  </div>
                  <p className="text-base font-semibold text-ink">
                    Подготавливаем книгу…
                  </p>
                  <p className="mt-1 text-xs text-ink-muted max-w-sm mx-auto truncate">
                    {state.fileName}
                  </p>
                  <p className="mt-4 text-xs text-ink-muted/80">
                    Пожалуйста, подождите несколько секунд
                  </p>
                </div>
              )}

              {/* State: IDLE / DRAGGING / ERROR */}
              {(state.status === "idle" ||
                state.status === "dragging" ||
                state.status === "error") && (
                <div>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`group relative cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center transition-all duration-200 ${
                      state.status === "dragging"
                        ? "border-accent bg-accent-soft/40 scale-[1.01]"
                        : state.status === "error"
                        ? "border-red-400/50 bg-red-50/20"
                        : "border-border hover:border-accent/60 hover:bg-paper-soft"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.epub,.txt,.md,.json,application/pdf,application/epub+zip,text/plain,text/markdown,application/json"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    <div
                      className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-200 ${
                        state.status === "dragging"
                          ? "bg-accent/20 scale-110"
                          : "bg-ink/5 group-hover:bg-accent/15 group-hover:scale-105"
                      }`}
                    >
                      <svg
                        className={`h-7 w-7 transition-colors ${
                          state.status === "dragging"
                            ? "text-accent"
                            : "text-ink-muted group-hover:text-accent"
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
                        />
                      </svg>
                    </div>

                    <p className="text-base font-semibold text-ink">
                      Нажмите, чтобы выбрать файл
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      или перетащите файл в это окно
                    </p>

                    <p className="mt-4 text-[11px] text-ink-muted/70">
                      Поддерживаемые форматы: PDF, EPUB, TXT, MD, JSON (до {MAX_SIZE_MB} МБ)
                    </p>

                    {state.status === "error" && (
                      <div className="mt-4 rounded-xl bg-red-100/90 dark:bg-red-950/40 border border-red-300 dark:border-red-900/50 px-4 py-3 text-xs text-red-700 dark:text-red-300">
                        <span>{state.message}</span>
                        {state.needsLogin && (
                          <a
                            href="/login"
                            onClick={(e) => e.stopPropagation()}
                            className="ml-3 font-semibold underline hover:no-underline"
                          >
                            Войти
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            resetUpload();
                          }}
                          className="ml-3 font-semibold underline hover:no-underline"
                        >
                          Попробовать снова
                        </button>
                      </div>
                    )}
                  </div>

                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl px-1 text-left text-xs leading-relaxed text-ink-muted">
                    <input
                      type="checkbox"
                      checked={rightsConfirmed}
                      onChange={(e) => {
                        setRightsConfirmed(e.target.checked);
                        if (e.target.checked && state.status === "error") resetUpload();
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                    />
                    <span>
                      Я подтверждаю, что у меня есть право загружать этот файл: это моя книга или
                      копия для личного чтения. Книга будет видна только мне.
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
