export default function NotesLoading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 animate-pulse">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="h-4 w-36 rounded bg-border/60" />
          <div className="mt-3 h-9 w-48 rounded bg-border/80" />
        </div>
        <div className="h-5 w-32 rounded bg-border/60" />
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <div className="h-8 w-16 rounded-full bg-border/60" />
        <div className="h-8 w-20 rounded-full bg-border/40" />
        <div className="h-8 w-24 rounded-full bg-border/40" />
        <div className="h-8 w-18 rounded-full bg-border/40" />
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-paper-soft p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 rounded bg-border/60" />
              <div className="h-4 w-20 rounded bg-border/40" />
            </div>
            <div className="h-5 w-full rounded bg-border/70" />
            <div className="h-5 w-3/4 rounded bg-border/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
