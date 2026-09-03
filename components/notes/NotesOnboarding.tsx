"use client";

import { useSyncExternalStore } from "react";
import { highlightTypes } from "@/lib/highlights/types";

const storageKey = "notes_onboarding_completed";
const storageEventName = "notes-onboarding-change";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(storageEventName, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(storageEventName, onStoreChange);
  };
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(storageKey) !== "true";
  } catch {
    return false;
  }
}

export function NotesOnboarding() {
  const isOpen = useSyncExternalStore(subscribe, getSnapshot, () => false);

  function complete() {
    try {
      window.localStorage.setItem(storageKey, "true");
    } catch {
      // Storage is optional for this local-only onboarding.
    }
    window.dispatchEvent(new Event(storageEventName));
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notes-onboarding-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/35 p-6"
    >
      <div className="w-full max-w-xl rounded-md bg-paper p-6 shadow-xl">
        <h2 id="notes-onboarding-title" className="font-serif text-2xl">
          Как работают мои заметки
        </h2>
        <p className="mt-2 text-ink-muted">
          Сохраняй не просто текст. Сохраняй то, зачем он тебе нужен.
        </p>
        <div className="mt-5 space-y-3">
          {highlightTypes.map((item) => (
            <div key={item.type} className="flex gap-3">
              <span
                aria-hidden="true"
                className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${item.menuClassName}`}
              />
              <p>
                <span className="font-medium">
                  {item.name} — {item.colorName.toLowerCase()}
                </span>
                <br />
                <span className="text-sm text-ink-muted">{item.description}</span>
              </p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-ink-muted">
          Не знаешь, куда отнести фрагмент? Выбери тип, который лучше всего
          объясняет, зачем ты хочешь сохранить этот текст.
        </p>
        <button
          type="button"
          onClick={complete}
          className="mt-6 rounded-sm bg-accent px-4 py-2 text-sm font-medium text-paper hover:bg-accent/90"
        >
          Понятно, начать читать
        </button>
      </div>
    </div>
  );
}
