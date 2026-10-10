import type { NextConfig } from "next";

const LEGACY_HOSTS = ["sysgeeks.vercel.app", "interviewgeek.vercel.app"];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  async redirects() {
    return [
      // The Vercel hosts serve the same pages as the domain; send them, and their ranking, to the domain.
      ...LEGACY_HOSTS.map((host) => ({
        source: "/:path*",
        has: [{ type: "host" as const, value: host }],
        destination: "https://www.sysgeeks.com/:path*",
        permanent: true,
      })),
      // Practice, progress and the mock interview were merged into Review.
      { source: "/understanding", destination: "/review", permanent: true },
      { source: "/pricing", destination: "/#pricing", permanent: true },
      { source: "/practice", destination: "/review#claims", permanent: true },
      { source: "/interview", destination: "/review#session", permanent: true },
    ];
  },
};

export default nextConfig;
