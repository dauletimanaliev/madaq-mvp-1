import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    // Protect everything except public routes:
    // - / (library home)
    // - /login
    // - /api/auth/* (Auth.js handlers)
    // - /api/books/upload (direct multipart upload handler)
    // - _next/static, _next/image, favicon, public assets
    "/((?!_next/static|_next/image|favicon\\.ico|api/auth|api/books/upload|login$|$).*)",
  ],
};
