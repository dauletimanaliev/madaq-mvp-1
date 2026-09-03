export default function LibraryLoading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 animate-pulse">
      <div>
        <div className="h-4 w-32 rounded bg-border/60" />
        <div className="mt-3 h-9 w-64 rounded bg-border/80" />
      </div>

      <div className="mt-10 flex flex-col gap-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-6 rounded-xl border border-border bg-paper-soft p-5"
          >
            <div className="h-28 w-20 shrink-0 rounded-md bg-border/60" />
            <div className="flex-1 space-y-3">
              <div className="h-6 w-48 rounded bg-border/80" />
              <div className="h-4 w-32 rounded bg-border/50" />
              <div className="h-4 w-full rounded bg-border/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
