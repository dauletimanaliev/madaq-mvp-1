export function ReaderControls({
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  progressPercent,
}: {
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  progressPercent: number;
}) {
  return (
    <div className="flex items-center justify-between border-t border-reader-text/10 pt-4 text-sm text-reader-muted">
      <button
        type="button"
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className="min-h-11 min-w-11 px-3 hover:text-reader-text disabled:cursor-not-allowed disabled:opacity-0"
      >
        Назад
      </button>

      <span>{Math.round(progressPercent)}%</span>

      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        className="min-h-11 min-w-11 px-3 hover:text-reader-text disabled:cursor-not-allowed disabled:opacity-0"
      >
        Дальше
      </button>
    </div>
  );
}
