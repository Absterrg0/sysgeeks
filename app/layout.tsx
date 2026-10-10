import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Funnel_Display, Funnel_Sans } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "@/components/feedback";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StorageNotice } from "@/components/storage-notice";
import { DIFFICULTY } from "@/components/investigation/difficulty";
import type { StageBarInvestigation } from "@/components/investigation/stage-bar";
import { listInvestigations } from "@/lib/content";
import { publicFeatures } from "@/lib/config";
import { themeInitScript } from "@/lib/domain/theme";
import { jsonLd, TITLE_SUFFIX } from "@/lib/metadata";
import { SITE_DESCRIPTION, SITE_NAME, SITE_REPO_URL, SITE_TITLE, SITE_URL, SITE_X_HANDLE, SITE_X_URL } from "@/lib/site";
import "./globals.css";

// Funnel Sans for reading and the interface; Funnel Display for titles.
const sans = Funnel_Sans({ subsets: ["latin"], variable: "--font-funnel-sans", display: "swap" });
const display = Funnel_Display({ subsets: ["latin"], variable: "--font-funnel-display", display: "swap" });
// Labels, numerals and code: pinned to weight 400 and subset to ASCII, 5.5 kB.
const mono = localFont({
  src: "../assets/fonts/GeistMono-Latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});
// Geist Pixel: the wordmark and the few lit words on the display. Latin-1, 24 kB.
const pixel = localFont({
  src: "../assets/fonts/GeistPixel-Regular.woff",
  variable: "--font-geist-pixel",
  display: "swap",
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
  // Search Console and Bing Webmaster Tools can verify by meta tag, as an alternative to a DNS record.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F7F9" },
    { media: "(prefers-color-scheme: dark)", color: "#07080A" },
  ],
};

// Light-mode values from design.md §8. Dark mode isn't themed yet, since Clerk's appearance is static.
const clerkAppearance = {
  variables: {
    colorPrimary: "#0B0B0C",
    colorText: "#0B0B0C",
    colorTextSecondary: "#4A4B51",
    colorBackground: "#FFFFFF",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#0B0B0C",
    colorDanger: "#B4233A",
    colorSuccess: "#0B6A4E",
    colorWarning: "#8F4E00",
    borderRadius: "6px",
    fontFamily: "var(--font-funnel-sans), ui-sans-serif, system-ui",
  },
  elements: { card: "shadow-none ring-1 ring-rule rounded-[14px]", formButtonPrimary: "btn btn-primary" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const investigations: StageBarInvestigation[] = listInvestigations().map((inv) => ({
    id: inv.id,
    title: inv.title,
    stages: inv.stages.map((s) => ({ id: s.id, title: s.title, phase: s.phase })),
    level: DIFFICULTY[inv.difficulty],
    outline: inv.system.components.map((c) => ({
      col: c.position.col,
      row: c.position.row,
      store: ["database", "cache", "object-store", "queue", "stream"].includes(c.kind),
    })),
  }));

  const { auth } = publicFeatures();
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
        <SiteHeader investigations={investigations} auth={auth} />
        <StorageNotice />
        <main id="main" className="shell flex-1">
          {children}
        </main>
        <SiteFooter />
        <Toaster />
      </div>
      <div className="grain" aria-hidden="true" />
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
      <Analytics />
      <SpeedInsights />
    </>
  );

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable} ${mono.variable} ${pixel.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh">
        {auth ? <ClerkProvider appearance={clerkAppearance}>{page}</ClerkProvider> : page}
      </body>
    </html>
  );
}
