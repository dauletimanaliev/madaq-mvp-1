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
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        {/* Continuous background with true curved scoop/notch */}
        <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
          {/* Left wing */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-paper/95 backdrop-blur-md border-t border-border"
            style={{ right: "calc(50% + 42px)" }}
          />

          {/* Right wing */}
          <div
            className="absolute top-0 bottom-0 right-0 bg-paper/95 backdrop-blur-md border-t border-border"
            style={{ left: "calc(50% + 42px)" }}
          />

          {/* Center notch cradle (fixed 84px wide, dips down 28px) */}
          <div
            className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[84px]"
          >
            {/* Top 32px holds the smooth curve */}
            <div className="absolute top-0 left-0 right-0 h-[32px]">
              <svg
                className="w-full h-full"
                viewBox="0 0 84 32"
                fill="none"
              >
                {/* Solid paper mask below the curve */}
                <path
                  d="M0 0 C18 0 22 28 42 28 C62 28 66 0 84 0 L84 32 L0 32 Z"
                  fill="var(--paper)"
                />
                {/* Continuous border stroke across the curve */}
                <path
                  d="M0 0.5 C18 0.5 22 28.5 42 28.5 C62 28.5 66 0.5 84 0.5"
                  stroke="var(--border)"
                  strokeWidth="1"
                  fill="none"
                />
              </svg>
            </div>
            {/* Bottom fill below the curve down to the edge of the screen */}
            <div className="absolute top-[32px] bottom-0 left-0 right-0 bg-paper/95 backdrop-blur-md" />
          </div>
        </div>

        <div className="relative mx-auto flex max-w-md items-center justify-between px-3 pt-2 pb-1">
          {/* Left tabs: Библиотека & Закладки */}
          <div className="flex flex-1 items-center justify-around pr-1">
            {navItems.slice(0, 2).map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    isActive
                      ? "text-ink font-semibold bg-paper-soft"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <div className={isActive ? "text-accent" : "text-ink-muted"}>
                    {item.icon}
                  </div>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Central Elevated Action Button (+ button docking in notch) */}
          <div className="relative flex flex-col items-center justify-center w-14 shrink-0 -mt-6">
            {/* Ambient backlight glow */}
            <div
              className="absolute -top-1 w-14 h-14 rounded-full pointer-events-none opacity-70 blur-md"
              style={{
                background:
                  "radial-gradient(circle, rgba(122, 46, 58, 0.5) 0%, rgba(122, 46, 58, 0) 70%)",
              }}
            />

            {/* Cradle depth shadow */}
            <div className="absolute top-2 w-12 h-6 rounded-full bg-ink/5 blur-sm pointer-events-none" />

            {/* Elevated Button */}
            <button
              id="mobile-add-book-fab"
              type="button"
              onClick={openAddBookModal}
              aria-label="Добавить книгу"
              title="Добавить книгу"
              className="relative flex items-center justify-center rounded-full text-white transition-all duration-200 active:scale-90 focus:outline-none"
              style={{
                width: "52px",
                height: "52px",
                background:
                  "linear-gradient(135deg, #8f3442 0%, #7a2e3a 52%, #5e1f29 100%)",
                boxShadow:
                  "0 8px 22px -2px rgba(122, 46, 58, 0.55), 0 3px 8px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.35)",
                border: "3.5px solid var(--paper)",
              }}
            >
              <svg
                className="w-6 h-6 transition-transform duration-200 active:rotate-90"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            </button>
          </div>

          {/* Right tabs: Заметки & Профиль */}
          <div className="flex flex-1 items-center justify-around pl-1">
            {navItems.slice(2, 4).map((item) => {
              const isActive = pathname?.startsWith(item.href);
              const isProfileTab = item.href === "/profile";
              const showAvatar = isProfileTab && session?.user?.image;

              return (
                <Link
                  key={item.href}
                  href={
                    session?.user
                      ? item.href
                      : isProfileTab
                      ? "/login"
                      : item.href
                  }
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    isActive
                      ? "text-ink font-semibold bg-paper-soft"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <div className={isActive ? "text-accent" : "text-ink-muted"}>
                    {showAvatar ? (
                      <img
                        src={session?.user?.image ?? ""}
                        alt=""
                        className="h-5 w-5 rounded-full border border-border"
                      />
                    ) : (
                      item.icon
                    )}
                  </div>
                  <span>{isProfileTab && !session?.user ? "Войти" : item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
