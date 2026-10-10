import type { MetadataRoute } from "next";
import { listCompanies, listConcepts, listInvestigations } from "@/lib/content";
import { listExampleProjects } from "@/lib/content/example-projects";
import { PLAYGROUNDS } from "@/lib/content/playground";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    "/system-design-interview",
    "/investigations",
    "/concepts",
    "/companies",
    "/review",
    "/about",
    "/ai",
    "/legal/privacy",
    "/legal/refunds",
    "/legal/terms",
    ...listInvestigations().flatMap((inv) => [
      `/investigations/${inv.id}`,
      `/investigations/${inv.id}/review`,
      `/investigations/${inv.id}/design`,
      ...(PLAYGROUNDS[inv.id] ? [`/investigations/${inv.id}/playground`] : []),
      ...inv.stages.map((s) => `/investigations/${inv.id}/${s.id}`),
    ]),
    ...listConcepts().map((c) => `/concepts/${c.id}`),
    ...listCompanies().map((c) => `/companies/${c.id}`),
    "/projects/examples",
    ...listExampleProjects().map((e) => `/projects/examples/${e.id}`),
  ];
  return paths.map((path) => ({ url: `${SITE_URL}${path}` }));
}
