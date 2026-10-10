/** Absolute origin for sitemaps and metadata. Production sets SITE_URL to https://www.sysgeeks.com. */
export const SITE_URL =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const SITE_NAME = "SysGeeks";

export const SITE_TITLE = "Free System Design Interview Practice · SysGeeks";

export const SITE_DESCRIPTION =
  "System design interview practice on real systems: URL shortener, rate limiter, news feed, payments and more. Decide, break it, defend it. Free, no signup.";

/** The public source repository: linked from the footer and listed as the organization's `sameAs`. */
export const SITE_REPO_URL = "https://github.com/Absterrg0/sysgeeks";

/** The X (Twitter) account: credited on link cards and listed as the organization's `sameAs`. */
export const SITE_X_HANDLE = "@sysGeeks";
export const SITE_X_URL = "https://x.com/sysGeeks";

/** A display host for share cards and footers, e.g. "www.sysgeeks.com". */
export const SITE_HOST = new URL(SITE_URL).host;
