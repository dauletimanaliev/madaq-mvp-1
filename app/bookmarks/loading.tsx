export default function BookmarksLoading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 animate-pulse">
      <div>
        <div className="h-4 w-36 rounded bg-border/60" />
        <div className="mt-3 h-9 w-40 rounded bg-border/80" />
      </div>

      <div className="mt-10 flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-paper-soft p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 rounded bg-border/60" />
              <div className="h-4 w-24 rounded bg-border/40" />
            </div>
            <div className="h-5 w-4/5 rounded bg-border/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
