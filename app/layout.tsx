import type { Metadata } from "next";
import { Lora, Manrope } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin", "cyrillic"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Madaq — читай не отвлекаясь",
  description: "Небольшая библиотека книг с закладками и прогрессом чтения.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${lora.variable} ${manrope.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-paper text-ink antialiased">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
            <Link href="/" className="font-serif text-lg tracking-tight">
              Madaq
            </Link>
            <nav className="flex gap-6 text-sm text-ink-muted">
              <Link href="/" className="hover:text-ink">
                Библиотека
              </Link>
              <Link href="/bookmarks" className="hover:text-ink">
                Закладки
              </Link>
              <Link href="/notes" className="hover:text-ink">
                Мои заметки
              </Link>
              <Link href="/profile" className="hover:text-ink">
                Профиль
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
