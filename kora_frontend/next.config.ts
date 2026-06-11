import type { NextConfig } from "next";

/**
 * Backend target for the `/api/*` proxy. Override with BACKEND_URL in
 * `.env.local` if Django runs somewhere other than localhost:8000.
 */
const backendUrl = (process.env.BACKEND_URL || "http://localhost:8000").replace(
  /\/+$/,
  "",
);

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      // Proxy `/api/*` to the Django backend so SSE / long-lived streams
      // share the same auth + base URL as the regular REST calls.
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
