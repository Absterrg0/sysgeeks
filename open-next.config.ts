import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Every public page is prerendered at build time and nothing revalidates, so the build output is
// the whole cache: pages are read from Workers static assets (free, no R2/KV reads, nothing to
// exhaust like Vercel's ISR read units). Cache interception answers those prerendered pages
// before Next.js boots, which keeps CPU per request low.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
