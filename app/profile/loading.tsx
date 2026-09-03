export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 animate-pulse">
      <div>
        <div className="h-4 w-24 rounded bg-border/60" />
        <div className="mt-3 h-9 w-48 rounded bg-border/80" />
        <div className="mt-3 h-4 w-80 rounded bg-border/40" />
      </div>

      <div className="mt-10 grid max-w-xs grid-cols-2 gap-6">
        <div>
          <div className="h-4 w-28 rounded bg-border/50" />
          <div className="mt-2 h-8 w-12 rounded bg-border/80" />
        </div>
        <div>
          <div className="h-4 w-24 rounded bg-border/50" />
          <div className="mt-2 h-8 w-12 rounded bg-border/80" />
        </div>
      </div>
    </div>
  );
}
