"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
    }
  | { status: "error"; message: string };

const ACCEPTED_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
];
const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".md", ".json"];
const MAX_SIZE_MB = 50;

export function BookUpload() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });

  const isValidFile = useCallback((file: File) => {
    if (ACCEPTED_TYPES.includes(file.type)) return true;
    return ACCEPTED_EXTENSIONS.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!isValidFile(file)) {
        setState({
          status: "error",
          message: "Поддерживаемые форматы: PDF, TXT, MD, JSON",
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

      // Step 1: Uploading
      setState({
        status: "uploading",
        fileName: file.name,
        step: 1,
        stepText: "Загрузка файла и генерация обложки…",
      });

      // Simulation steps for great UX
      const timer1 = setTimeout(() => {
        setState((prev) =>
          prev.status === "uploading"
            ? {
                ...prev,
                step: 2,
                stepText: "Определение названия и автора из текста…",
              }
            : prev
        );
      }, 1500);

      const timer2 = setTimeout(() => {
        setState((prev) =>
          prev.status === "uploading"
            ? {
                ...prev,
                step: 3,
                stepText: "Форматирование текста и разбиение на главы…",
              }
            : prev
        );
      }, 3500);

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
            body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
          });

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
            clearTimeout(timer2);
            setState({
              status: "error",
              message: uploadErrorMsg || "Не удалось загрузить файл в хранилище. Попробуйте ещё раз.",
            });
            return;
          }
          const formData = new FormData();
          formData.append("file", file);
          uploadPayload = formData;
        }

        const response = await fetch("/api/books/upload", {
          method: "POST",
          headers: uploadHeaders,
          body: uploadPayload,
        });

        clearTimeout(timer1);
        clearTimeout(timer2);

        const resText = await response.text();
        let data: {
          error?: string;
          bookId?: string;
          title?: string;
          author?: string;
          chaptersCount?: number;
          coverUrl?: string | null;
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
        });

        // Refresh library page data in background
        router.refresh();
      } catch (err) {
        clearTimeout(timer1);
        clearTimeout(timer2);
        setState({
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "Не удалось загрузить файл. Попробуйте ещё раз.",
        });
      }
    },
    [isValidFile, router]
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
    setState((prev) =>
      prev.status === "dragging" ? { status: "idle" } : prev
    );
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

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  // ────────────────── Render ──────────────────

  if (state.status === "done") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 sm:p-8 backdrop-blur-sm transition-all duration-300">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Cover preview */}
          {state.coverUrl ? (
            <div className="relative h-44 w-32 shrink-0 overflow-hidden rounded-xl shadow-lg border border-border/50 bg-paper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={state.coverUrl}
                alt={state.title}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-44 w-32 shrink-0 items-center justify-center rounded-xl bg-accent-soft/30 border border-border/50 text-accent">
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          )}

          {/* Book Info */}
          <div className="flex-1 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Книга успешно добавлена
            </div>

            <h3 className="mt-3 text-xl font-bold text-ink leading-tight">
              «{state.title}»
            </h3>
            <p className="mt-1 text-sm font-medium text-ink-muted">
              {state.author}
            </p>
            <p className="mt-2 text-xs text-ink-muted/80">
              {state.chaptersCount}{" "}
              {state.chaptersCount === 1
                ? "глава"
                : state.chaptersCount < 5
                  ? "главы"
                  : "глав"} • Обложка и текст сохранены в БД
            </p>

            <div className="mt-6 flex flex-wrap justify-center sm:justify-start gap-3">
              <button
                type="button"
                onClick={() => router.push(`/books/${state.bookId}/read`)}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 active:scale-95 transition-all"
              >
                <span>Начать читать</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-xl border border-border bg-paper px-5 py-2.5 text-sm font-medium text-ink-muted hover:text-ink hover:border-ink/30 active:scale-95 transition-all"
              >
                Загрузить ещё книгу
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "uploading") {
    return (
      <div className="rounded-2xl border-2 border-dashed border-accent/40 bg-accent-soft/20 p-8 text-center transition-all">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
          <div className="h-7 w-7 animate-spin rounded-full border-3 border-accent/30 border-t-accent" />
        </div>
        <p className="text-base font-semibold text-ink">
          {state.stepText}
        </p>
        <p className="mt-1 text-xs text-ink-muted max-w-sm mx-auto truncate">
          {state.fileName}
        </p>

        {/* Step indicator */}
        <div className="mt-6 flex justify-center items-center gap-2">
          {[1, 2, 3].map((stepNum) => (
            <div
              key={stepNum}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                stepNum <= state.step
                  ? "w-8 bg-accent"
                  : "w-2 bg-accent/20"
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-muted/70">
          Шаг {state.step} из 3 • Всё происходит автоматически
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Drop zone: pure 1-step automated experience */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 ${
          state.status === "dragging"
            ? "border-accent bg-accent-soft/40 scale-[1.01]"
            : state.status === "error"
              ? "border-red-400/50 bg-red-50/20"
              : "border-border hover:border-accent/60 hover:bg-paper-soft/60"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.json,application/pdf,text/plain,text/markdown,application/json"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Upload icon */}
        <div
          className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-200 ${
            state.status === "dragging"
              ? "bg-accent/20 scale-110"
              : "bg-ink/5 group-hover:bg-accent/15 group-hover:scale-105"
          }`}
        >
          <svg
            className={`h-8 w-8 transition-colors ${
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
          {state.status === "dragging"
            ? "Отпустите файл для загрузки"
            : "Перетащите PDF сюда или нажмите для выбора"}
        </p>

        <p className="mt-2 text-xs text-ink-muted">
          ⚡ <strong>100% Автоматически:</strong> название, автор, обложка и главы сформируются сами
        </p>
        <p className="mt-1 text-[11px] text-ink-muted/60">
          Поддерживаются PDF, TXT, MD до {MAX_SIZE_MB} МБ
        </p>

        {state.status === "error" && (
          <div className="mt-4 rounded-xl bg-red-100/90 dark:bg-red-950/40 border border-red-300 dark:border-red-900/50 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <span>{state.message}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
              className="ml-3 font-semibold underline hover:no-underline"
            >
              Попробовать снова
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
