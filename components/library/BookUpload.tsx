"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type UploadState =
  | { status: "idle" }
  | { status: "dragging" }
  | { status: "uploading"; fileName: string; progress: number }
  | { status: "processing"; fileName: string }
  | {
      status: "done";
      bookId: string;
      title: string;
      chaptersCount: number;
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
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");

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

      setState({ status: "uploading", fileName: file.name, progress: 0 });

      const formData = new FormData();
      formData.append("file", file);
      if (title.trim()) formData.append("title", title.trim());
      if (author.trim()) formData.append("author", author.trim());

      try {
        // Simulate upload progress
        const progressInterval = setInterval(() => {
          setState((prev) => {
            if (prev.status !== "uploading") return prev;
            const next = Math.min(prev.progress + Math.random() * 15, 90);
            return { ...prev, progress: next };
          });
        }, 200);

        setState((prev) => {
          if (prev.status === "uploading") {
            return { status: "processing", fileName: prev.fileName };
          }
          return prev;
        });

        const response = await fetch("/api/books/upload", {
          method: "POST",
          body: formData,
        });

        clearInterval(progressInterval);

        const data = await response.json();

        if (!response.ok) {
          setState({ status: "error", message: data.error });
          return;
        }

        setState({
          status: "done",
          bookId: data.bookId,
          title: data.title,
          chaptersCount: data.chaptersCount,
        });

        // Reset the title / author fields
        setTitle("");
        setAuthor("");
      } catch (err) {
        setState({
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "Не удалось загрузить файл. Попробуйте ещё раз.",
        });
      }
    },
    [isValidFile, title, author]
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
      // Reset input so the same file can be selected again
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
      <div className="rounded-xl border-2 border-dashed border-green-600/40 bg-green-50/50 p-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-green-900">
          «{state.title}» добавлена!
        </p>
        <p className="mt-1 text-sm text-green-700">
          {state.chaptersCount}{" "}
          {state.chaptersCount === 1
            ? "глава"
            : state.chaptersCount < 5
              ? "главы"
              : "глав"}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/books/${state.bookId}/read`)}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 active:scale-95"
          >
            Начать читать
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-ink-muted transition-all hover:border-ink/30 active:scale-95"
          >
            Загрузить ещё
          </button>
        </div>
      </div>
    );
  }

  if (state.status === "uploading" || state.status === "processing") {
    return (
      <div className="rounded-xl border-2 border-dashed border-accent/30 bg-accent-soft/30 p-8 text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
        <p className="text-sm font-medium text-ink">
          {state.status === "uploading"
            ? "Загрузка файла…"
            : "Извлечение текста и разбиение на главы…"}
        </p>
        <p className="mt-1 text-xs text-ink-muted">{state.fileName}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Optional metadata fields */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="book-title" className="mb-1 block text-xs font-medium text-ink-muted">
            Название книги <span className="text-ink-muted/60">(необязательно)</span>
          </label>
          <input
            id="book-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Определится автоматически"
            className="w-full rounded-lg border border-border bg-paper-soft px-3 py-2 text-sm text-ink placeholder:text-ink-muted/50 transition-colors focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="book-author" className="mb-1 block text-xs font-medium text-ink-muted">
            Автор <span className="text-ink-muted/60">(необязательно)</span>
          </label>
          <input
            id="book-author"
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Неизвестный автор"
            className="w-full rounded-lg border border-border bg-paper-soft px-3 py-2 text-sm text-ink placeholder:text-ink-muted/50 transition-colors focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all duration-200 ${
          state.status === "dragging"
            ? "border-accent bg-accent-soft/40 scale-[1.01]"
            : state.status === "error"
              ? "border-red-400/50 bg-red-50/30"
              : "border-border hover:border-accent/50 hover:bg-paper-soft/80"
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
          className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors ${
            state.status === "dragging"
              ? "bg-accent/15"
              : "bg-ink/5 group-hover:bg-accent/10"
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

        <p className="text-sm font-medium text-ink">
          {state.status === "dragging"
            ? "Отпустите файл"
            : "Перетащите файл сюда или нажмите для выбора"}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          PDF, TXT, MD или JSON • до {MAX_SIZE_MB} МБ
        </p>

        {state.status === "error" && (
          <div className="mt-4 rounded-lg bg-red-100/80 px-4 py-2.5 text-sm text-red-700">
            {state.message}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
              className="ml-2 font-medium underline hover:no-underline"
            >
              Повторить
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
