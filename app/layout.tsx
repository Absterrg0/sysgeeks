import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "@/components/feedback";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteAnalytics } from "@/components/site-analytics";
import { StorageNotice } from "@/components/storage-notice";
import { DIFFICULTY } from "@/components/investigation/difficulty";
import type { StageBarInvestigation } from "@/components/investigation/stage-bar";
import { PLAYGROUNDS } from "@/lib/content/playground";
import { listInvestigations } from "@/lib/content";
import { themeInitScript } from "@/lib/domain/theme";
import { jsonLd, TITLE_SUFFIX } from "@/lib/metadata";
import { SITE_DESCRIPTION, SITE_NAME, SITE_REPO_URL, SITE_TITLE, SITE_URL, SITE_X_HANDLE, SITE_X_URL } from "@/lib/site";
import "./globals.css";

// Geist for words, Geist Mono for data.
const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
// Labels, numerals and code: pinned to weight 400 and subset to ASCII, 5.5 kB.
const mono = localFont({
  src: "../assets/fonts/GeistMono-Latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s${TITLE_SUFFIX}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "system design interview",
    "system design practice",
    "system design interview questions",
    "high level design",
    "HLD interview",
    "distributed systems",
    "software engineering interview prep",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: SITE_X_HANDLE,
    creator: SITE_X_HANDLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: { googleBot: { "max-image-preview": "large" } },
  // Search Console and Bing Webmaster Tools can verify by meta tag, as an alternative to a DNS record.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E9EBEE" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0D0F" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const investigations: StageBarInvestigation[] = listInvestigations().map((inv) => ({
    id: inv.id,
    title: inv.title,
    stages: inv.stages.map((s) => ({ id: s.id, title: s.title, phase: s.phase })),
    level: DIFFICULTY[inv.difficulty],
    hasPlayground: Boolean(PLAYGROUNDS[inv.id]),
    outline: inv.system.components.map((c) => ({
      col: c.position.col,
      row: c.position.row,
      store: ["database", "cache", "object-store", "queue", "stream"].includes(c.kind),
    })),
  }));

  const page = (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 btn btn-secondary"
      >
        Skip to content
      </a>
      {/* The container for .bleed and the lit matrix, so full-width layers measure the window without its scrollbar. */}
      <div className="flex min-h-dvh flex-col overflow-x-clip [container-type:inline-size]">
        <SiteHeader investigations={investigations} />
        <StorageNotice />
        <main id="main" className="shell flex-1">
          {children}
        </main>
        <SiteFooter />
        <Toaster />
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@graph": [
              {
                "@type": "WebSite",
                "@id": `${SITE_URL}/#website`,
                name: SITE_NAME,
                url: SITE_URL,
                description: SITE_DESCRIPTION,
                inLanguage: "en",
                publisher: { "@id": `${SITE_URL}/#organization` },
              },
              {
                "@type": "Organization",
                "@id": `${SITE_URL}/#organization`,
                name: SITE_NAME,
                url: SITE_URL,
                description: SITE_DESCRIPTION,
                logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-icon`, width: 180, height: 180 },
                sameAs: [SITE_REPO_URL, SITE_X_URL],
              },
            ],
          }),
        }}
      />
      <SiteAnalytics />
    </>
  );

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh">
        {page}
      </body>
    </html>
  );
}
