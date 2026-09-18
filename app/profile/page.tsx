import { auth } from "@/auth";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { prisma } from "@/lib/db/prisma";
import { SignOutButton } from "./SignOutButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const userId = await getCurrentUserId();
  const session = await auth();

  // Load user data directly from DB to verify persistence and exact email
  const [dbUser, readingCount, bookmarksCount, notesCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
    }),
    prisma.readingProgress.count({
      where: { userId },
    }),
    prisma.bookmark.count({
      where: { userId },
    }),
    prisma.highlight.count({
      where: { userId },
    }),
  ]);

  const userEmail = dbUser?.email ?? session?.user?.email ?? "";
  const userName = dbUser?.name ?? session?.user?.name ?? "Читатель";
  const userAvatar = dbUser?.avatarUrl ?? session?.user?.image;

  // Format creation date
  const joinedDate = dbUser?.createdAt
    ? new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(
        new Date(dbUser.createdAt)
      )
    : null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 md:py-16">
      {/* Header breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-mono tracking-wider text-ink-muted uppercase">
        <Link href="/" className="hover:text-ink transition-colors">
          Главная
        </Link>
        <span>/</span>
        <span className="text-ink font-medium">Профиль читателя</span>
      </div>

      {/* User Card */}
      <div className="mt-8 rounded-2xl border border-border bg-paper-soft/40 p-6 sm:p-8 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={userName}
              className="h-16 w-16 rounded-full border-2 border-border shadow-sm object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white font-serif text-2xl font-bold shadow-sm">
              {(userName[0] ?? "?").toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-ink truncate">
              {userName}
            </h1>
            <p className="mt-1 font-mono text-sm text-ink-muted truncate">
              {userEmail}
            </p>
            {joinedDate && (
              <p className="mt-1 text-xs text-ink-muted">
                В читательском клубе с {joinedDate}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Statistics Section */}
      <div className="mt-8">
        <h2 className="text-xs font-mono uppercase tracking-wider text-ink-muted">
          Ваша статистика чтения
        </h2>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-paper p-5 transition-colors hover:border-accent/30">
            <dt className="text-xs text-ink-muted">Читает сейчас</dt>
            <dd className="mt-2 font-serif text-3xl font-medium text-ink">
              {readingCount}
            </dd>
            <p className="mt-1 text-xs text-ink-muted">активных книг</p>
          </div>

          <Link
            href="/bookmarks"
            className="rounded-xl border border-border bg-paper p-5 transition-all hover:border-accent/40 hover:shadow-xs group"
          >
            <dt className="text-xs text-ink-muted group-hover:text-accent transition-colors">
              Закладки
            </dt>
            <dd className="mt-2 font-serif text-3xl font-medium text-ink">
              {bookmarksCount}
            </dd>
            <p className="mt-1 text-xs text-ink-muted">сохранённых мест →</p>
          </Link>

          <Link
            href="/notes"
            className="rounded-xl border border-border bg-paper p-5 transition-all hover:border-accent/40 hover:shadow-xs group"
          >
            <dt className="text-xs text-ink-muted group-hover:text-accent transition-colors">
              Заметки и цитаты
            </dt>
            <dd className="mt-2 font-serif text-3xl font-medium text-ink">
              {notesCount}
            </dd>
            <p className="mt-1 text-xs text-ink-muted">выделений в тексте →</p>
          </Link>
        </div>
      </div>

      {/* Quick navigation links */}
      <div className="mt-10 border-t border-border pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link
            href="/"
            className="text-ink-muted hover:text-ink transition-colors underline underline-offset-4"
          >
            ← В библиотеку
          </Link>
          <Link
            href="/bookmarks"
            className="text-ink-muted hover:text-ink transition-colors underline underline-offset-4"
          >
            К закладкам
          </Link>
          <Link
            href="/notes"
            className="text-ink-muted hover:text-ink transition-colors underline underline-offset-4"
          >
            К заметкам
          </Link>
        </div>

        <SignOutButton />
      </div>
    </div>
  );
}
