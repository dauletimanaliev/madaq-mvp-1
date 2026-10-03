"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { openAddBookModal } from "@/components/library/AddBookFabModal";

const navItems = [
  {
    href: "/",
    label: "Библиотека",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    href: "/bookmarks",
    label: "Закладки",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    ),
  },
  {
    href: "/notes",
    label: "Заметки",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Профиль",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isReaderPage = pathname?.includes("/read");

  if (isReaderPage) {
    return null;
  }

  return (
    <>
      {/* Desktop Header */}
      <header className="border-b border-border bg-paper sticky top-0 z-30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-serif text-xl tracking-tight font-medium">
            Madaq
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <nav className="flex gap-6 text-sm text-ink-muted">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname?.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`transition-colors py-1 ${
                      isActive ? "text-ink font-medium" : "hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            {session?.user ? (
              <Link href="/profile" className="flex items-center gap-2 ml-2">
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-7 w-7 rounded-full border border-border"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-accent-soft border border-border flex items-center justify-center text-xs font-medium text-accent">
                    {(session.user.name?.[0] ?? "?").toUpperCase()}
                  </div>
                )}
              </Link>
            ) : (
              <Link
                href="/login"
                className="ml-2 rounded-lg border border-border px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-accent/30 hover:text-ink"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Мобильная навигация"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-paper/95 backdrop-blur-md border-t border-border pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto grid grid-cols-5 items-center max-w-md px-2 py-1.5">
          {/* 1. Библиотека */}
          <Link
            href="/"
            className={`flex flex-col items-center gap-1 py-1 px-1 rounded-lg text-xs transition-colors ${
              pathname === "/"
                ? "text-ink font-semibold bg-paper-soft"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <div className={pathname === "/" ? "text-accent" : "text-ink-muted"}>
              {navItems[0].icon}
            </div>
            <span className="text-[11px] leading-tight">{navItems[0].label}</span>
          </Link>

          {/* 2. Закладки */}
          <Link
            href="/bookmarks"
            className={`flex flex-col items-center gap-1 py-1 px-1 rounded-lg text-xs transition-colors ${
              pathname?.startsWith("/bookmarks")
                ? "text-ink font-semibold bg-paper-soft"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <div className={pathname?.startsWith("/bookmarks") ? "text-accent" : "text-ink-muted"}>
              {navItems[1].icon}
            </div>
            <span className="text-[11px] leading-tight">{navItems[1].label}</span>
          </Link>

          {/* 3. Добавить (обычная кнопка как Библиотека и Закладки) */}
          <button
            id="mobile-add-book-fab"
            type="button"
            onClick={openAddBookModal}
            className="flex flex-col items-center gap-1 py-1 px-1 rounded-lg text-xs transition-colors text-ink-muted hover:text-ink active:scale-95 focus:outline-none"
            title="Добавить книгу"
            aria-label="Добавить книгу"
          >
            <div className="text-ink-muted hover:text-ink">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <span className="text-[11px] leading-tight">Добавить</span>
          </button>

          {/* 4. Заметки */}
          <Link
            href="/notes"
            className={`flex flex-col items-center gap-1 py-1 px-1 rounded-lg text-xs transition-colors ${
              pathname?.startsWith("/notes")
                ? "text-ink font-semibold bg-paper-soft"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <div className={pathname?.startsWith("/notes") ? "text-accent" : "text-ink-muted"}>
              {navItems[2].icon}
            </div>
            <span className="text-[11px] leading-tight">{navItems[2].label}</span>
          </Link>

          {/* 5. Профиль / Войти */}
          {(() => {
            const isProfileActive = pathname?.startsWith("/profile");
            const showAvatar = session?.user?.image;
            return (
              <Link
                href={session?.user ? "/profile" : "/login"}
                className={`flex flex-col items-center gap-1 py-1 px-1 rounded-lg text-xs transition-colors ${
                  isProfileActive
                    ? "text-ink font-semibold bg-paper-soft"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                <div className={isProfileActive ? "text-accent" : "text-ink-muted"}>
                  {showAvatar ? (
                    <img
                      src={session?.user?.image ?? ""}
                      alt=""
                      className="h-5 w-5 rounded-full border border-border"
                    />
                  ) : (
                    navItems[3].icon
                  )}
                </div>
                <span className="text-[11px] leading-tight">
                  {session?.user ? navItems[3].label : "Войти"}
                </span>
              </Link>
            );
          })()}
        </div>
      </nav>
    </>
  );
}
