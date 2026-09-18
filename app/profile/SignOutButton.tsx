"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="
        rounded-lg border border-border px-4 py-2 text-sm
        text-ink-muted transition-colors
        hover:border-accent/30 hover:text-ink
      "
    >
      Выйти из аккаунта
    </button>
  );
}
