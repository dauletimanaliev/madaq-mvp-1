import type { Metadata } from "next";
import { Lora, Manrope } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Providers } from "@/components/layout/Providers";
import { AddBookFabModal } from "@/components/library/AddBookFabModal";
import "./globals.css";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Madaq — читай не отвлекаясь",
  description: "Небольшая библиотека книг с закладками и прогрессом чтения.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport = {
  themeColor: "#1c1b1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${lora.variable} ${manrope.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-paper text-ink antialiased">
        <Providers>
          <ServiceWorkerRegister />
          <Header />
          <main className="flex-1 pb-20 md:pb-0">{children}</main>
          <AddBookFabModal />
        </Providers>
      </body>
    </html>
  );
}
