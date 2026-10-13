import type { NextConfig } from "next";
import { SITE_URL } from "./lib/site";

const LEGACY_HOSTS = ["sysgeeks.vercel.app", "interviewgeek.vercel.app"];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  experimental: {
    inlineCss: true,
  },
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
      // An old Bing-discovered URL for a ride-dispatch playground that no longer exists.
      { source: "/investigations/ride-dispatch/playground", destination: "/investigations/ride-dispatch", permanent: true },
    ];
  },
  async headers() {
    const pdfCanonicals = [
      [
        "/downloads/system-design-interview-practice-sheet.pdf",
        "/system-design-interview/worksheet",
      ],
      [
        "/downloads/system-design-interview-questions-and-answers.pdf",
        "/investigations",
      ],
      ["/downloads/system-design-interview-scorecard.pdf", "/system-design-interview/scorecard"],
    ] as const;

    return pdfCanonicals.map(([source, canonical]) => ({
      source,
      headers: [{ key: "Link", value: `<${SITE_URL}${canonical}>; rel="canonical"` }],
    }));
  },
};

export default nextConfig;
