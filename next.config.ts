import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { SITE_URL } from "./lib/site";

// The apex and the old Vercel hosts serve the same pages as www; send them, and their ranking, to www.
const LEGACY_HOSTS = ["sysgeeks.com", "sysgeeks.vercel.app", "interviewgeek.vercel.app"];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  // No experimental.inlineCss: it copied the whole stylesheet into every HTML page and every RSC
  // payload (three times per page, ~330 kB), which is what exhausted Vercel's ISR read units.
  // The stylesheet is a hashed, immutable file that browsers and the CDN cache once.
  async redirects() {
    return [
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

// Exposes Cloudflare bindings to `next dev`.
initOpenNextCloudflareForDev();
