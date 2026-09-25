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
};

export default nextConfig;
