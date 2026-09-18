import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/db/prisma";

/**
 * Main Auth.js entry point.
 * JWT strategy — no extra session tables needed.
 * On first Google sign-in we upsert a row in our `users` table
 * so that all existing Prisma relations (bookmarks, progress, etc.)
 * work seamlessly.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  callbacks: {
    /** Runs on every sign-in attempt. Upsert user in our DB. */
    async signIn({ user, profile }) {
      if (!user.email) {
        console.warn("[auth] Sign-in rejected: user object has no email");
        return false;
      }

      try {
        const dbUser = await prisma.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name ?? undefined,
            avatarUrl: user.image ?? undefined,
            googleId: profile?.sub ?? undefined,
          },
          create: {
            email: user.email,
            name: user.name ?? null,
            avatarUrl: user.image ?? null,
            googleId: profile?.sub ?? null,
          },
        });
        console.log(`[auth] User signed in & synced with DB: ${dbUser.email} (id: ${dbUser.id})`);
        return true;
      } catch (error) {
        console.error("[auth] Failed to upsert user in database:", error);
        return false;
      }
    },

    /** Attach our internal userId to the JWT token. */
    async jwt({ token }) {
      try {
        if (token.email && !token.userId) {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email },
            select: { id: true },
          });
          if (dbUser) {
            token.userId = dbUser.id;
          }
        }
      } catch (error) {
        console.error("[auth] Error fetching userId in jwt callback:", error);
      }
      return token;
    },

    /** Expose userId on the client-side session object. */
    session({ session, token }) {
      if (token.userId && typeof token.userId === "string") {
        session.user.id = token.userId;
      }
      return session;
    },
  },
});
