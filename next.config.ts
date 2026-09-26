import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fkkdgjmtbzzvbvdswxiz.supabase.co",
        pathname: "/storage/v1/object/public/book-covers/**",
      },
    ],
  },
  serverExternalPackages: ["@napi-rs/canvas", "canvas", "unpdf"],
  compress: true,
  devIndicators: false,
  experimental: {
    proxyClientMaxBodySize: "50mb",
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  async headers() {
    if (process.env.NODE_ENV !== "production") {
      return [];
    }
    return [
      {
        // Global headers: HTTP/3 (QUIC) advertisement and security
        source: "/:path*",
        headers: [
          {
            key: "Alt-Svc",
            value: 'h3=":443"; ma=86400, h3-29=":443"; ma=86400',
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        // Static assets (Next.js chunks, hashed files) - immutable long-term caching
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Media and book covers - CDN cached with stale-while-revalidate
        source: "/covers/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // Authenticated and private endpoints - never cached
        source: "/(api/auth|profile|bookmarks|notes)(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
