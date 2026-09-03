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
};

export default nextConfig;
