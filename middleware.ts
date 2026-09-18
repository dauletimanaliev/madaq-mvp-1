export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    // Protect everything except public routes:
    // - / (library home)
    // - /login
    // - /api/auth/* (Auth.js handlers)
    // - _next/static, _next/image, favicon, public assets
    "/((?!_next/static|_next/image|favicon\\.ico|api/auth|login$|$).*)",
  ],
};
