"use client";

type Tone = "light" | "sepia" | "dark";

const toneClasses: Record<Tone, { bar: string; track: string; text: string; bg: string }> = {
  light: { bar: "bg-accent", track: "bg-black/[0.06]", text: "text-ink-muted", bg: "bg-white/90" },
  sepia: { bar: "bg-[#6d281a]", track: "bg-[#382a18]/10", text: "text-[#7d674c]", bg: "bg-[#f4ecd8]/90" },
  dark: { bar: "bg-[#e09f67]", track: "bg-white/10", text: "text-[#a1a1aa]", bg: "bg-[#18181b]/90" },
};

/**
 * Page tracker shown while reading: "стр. 45 из 340 · 13%" with a thin
 * progress line. Renders nothing until the page count is known.
 */
export function ReaderProgress({
  page,
  total,
  tone = "light",
  className = "",
}: {
  page: number;
  total: number;
  tone?: Tone;
  className?: string;
}) {
  if (!total || total < 1) return null;
  const current = Math.min(Math.max(page, 1), total);
  const pct = Math.round((current / total) * 100);
  const t = toneClasses[tone];

  return (
    <div
      className={`pointer-events-none select-none ${t.bg} backdrop-blur-sm ${className}`}
      role="status"
      aria-label={`Страница ${current} из ${total}, прочитано ${pct}%`}
    >
      <div className={`h-0.5 w-full ${t.track}`}>
        <div className={`h-full ${t.bar} transition-[width] duration-300`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`py-1.5 text-center text-[11px] tabular-nums ${t.text}`}>
        стр. {current} из {total} · {pct}%
      </p>
    </div>
  );
}
