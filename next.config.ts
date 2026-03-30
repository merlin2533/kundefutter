import type { NextConfig } from "next";
import { randomUUID } from "crypto";

const buildId = randomUUID();

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["leaflet", "react-leaflet"],
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
