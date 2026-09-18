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
    redirect("/login");
  }

  return session.user.id;
}
