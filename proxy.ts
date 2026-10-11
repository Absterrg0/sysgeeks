import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { features } from "@/lib/config";

const AUTH_PATHS = ["/api/ai", "/api/billing", "/api/account", "/account", "/reports", "/sign-in", "/sign-up"];
const PUBLIC_CONTENT_PATHS = [
  "/about",
  "/ai",
  "/capacity-estimator",
  "/companies",
  "/concepts",
  "/downloads",
  "/investigations",
  "/legal",
  "/projects/examples",
  "/review",
  "/system-design-interview",
  "/system-design-mock-interview",
  "/system-design-playground",
];
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const CANONICAL_HOST = "www.sysgeeks.com";
const CRAWLER_USER_AGENT =
  /(?:Googlebot|GoogleOther|Google-Extended|Google-InspectionTool|bingbot|BingPreview|DuckDuckBot|Baiduspider|YandexBot|GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-SearchBot|Claude-User|PerplexityBot|Perplexity-User|Applebot(?:-Extended)?|Amazonbot|CCBot|Bytespider|cohere-ai|meta-external(?:agent|fetcher))/i;

const clerkProxy = features().auth ? clerkMiddleware() : undefined;

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isPublicContentPath(pathname: string): boolean {
  return pathname === "/" || PUBLIC_CONTENT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function captureCrawlerRequest(request: NextRequest, event: NextFetchEvent) {
  const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? "";
  const { hostname, pathname, protocol } = request.nextUrl;

  if (
    !POSTHOG_KEY ||
    hostname !== CANONICAL_HOST ||
    !isPublicContentPath(pathname) ||
    !CRAWLER_USER_AGENT.test(userAgent) ||
    !["GET", "HEAD"].includes(request.method) ||
    request.headers.has("rsc")
  ) {
    return;
  }

  const payload = {
    api_key: POSTHOG_KEY,
    event: "$http_log",
    distinct_id: "sysgeeks-crawler-requests",
    properties: {
      $process_person_profile: false,
      $geoip_disable: true,
      $current_url: `${protocol}//${hostname}${pathname}`,
      $host: hostname,
      $pathname: pathname,
      $raw_user_agent: userAgent,
      method: request.method,
    },
  };

  event.waitUntil(
    fetch(`${POSTHOG_HOST.replace(/\/$/, "")}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2_000),
    }).catch(() => undefined),
  );
}

// Clerk only runs where auth() is used. Public content requests are passed through;
// recognized search and AI crawler requests are logged asynchronously without client IPs.
export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isAuthPath(request.nextUrl.pathname) && clerkProxy) return clerkProxy(request, event);

  captureCrawlerRequest(request, event);
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/ai/:path*",
    "/api/billing/:path*",
    "/api/account",
    "/account/:path*",
    "/reports/:path*",
    "/sign-in/:path*",
    "/sign-up/:path*",
    {
      source: "/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
      has: [
        {
          type: "header",
          key: "user-agent",
          value:
            ".*(Googlebot|GoogleOther|Google-Extended|Google-InspectionTool|bingbot|BingPreview|DuckDuckBot|Baiduspider|YandexBot|GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-SearchBot|Claude-User|PerplexityBot|Perplexity-User|Applebot|Amazonbot|CCBot|Bytespider|cohere-ai|meta-externalagent|meta-externalfetcher).*",
        },
      ],
    },
  ],
};
