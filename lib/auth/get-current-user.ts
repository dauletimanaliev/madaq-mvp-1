import { auth } from "@/auth";
import { redirect } from "next/navigation";

/**
 * Returns the current user's internal DB id.
 * If there is no active session, redirects to /login.
 *
 * Use this in Server Components and Server Actions instead of DEMO_USER_ID.
 */
export async function getCurrentUserId(): Promise<string> {
  const session = await auth();

  if (!session?.user?.id) {
    if (process.env.NODE_ENV === "development") {
      return "demo_user";
    }
    redirect("/login");
  }

  return session.user.id;
}

/**
 * The signed-in user's id, or null for guests. In development a missing
 * session falls back to "demo_user", like getCurrentUserId.
 */
export async function getOptionalUserId(): Promise<string | null> {
  let session = null;
  try {
    session = await auth();
  } catch {
    session = null;
  }
  if (session?.user?.id) return session.user.id;
  return process.env.NODE_ENV === "development" ? "demo_user" : null;
}
