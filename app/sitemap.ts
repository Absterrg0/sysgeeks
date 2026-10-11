import type { MetadataRoute } from "next";
import { listCompanies, listConcepts, listInvestigations } from "@/lib/content";
import { listExampleProjects } from "@/lib/content/example-projects";
import { PLAYGROUNDS } from "@/lib/content/playground";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const rideDispatch = listInvestigations().find((investigation) => investigation.id === "ride-dispatch");
  const rideDispatchPaths = rideDispatch
    ? [
        "/investigations/ride-dispatch",
        "/investigations/ride-dispatch/review",
        "/investigations/ride-dispatch/design",
        ...rideDispatch.stages.map((stage) => `/investigations/ride-dispatch/${stage.id}`),
    ]
    : [];
  const updatedInvestigationTitles = listInvestigations().flatMap((investigation) => {
    const { id, searchTitle } = investigation;
    const paths = [`/investigations/${id}`];
    for (const stage of investigation.stages) {
      if (`${searchTitle}: ${stage.title}`.length > 55) paths.push(`/investigations/${id}/${stage.id}`);
    }
    if (`${searchTitle}: Practice Round from a Blank Page`.length > 55) {
      paths.push(`/investigations/${id}/design`);
    }
    const howTo = `How to ${searchTitle[0]?.toLowerCase()}${searchTitle.slice(1)}`;
    if (`${howTo}: Step-by-Step System Design`.length > 55) paths.push(`/investigations/${id}/review`);
    if (PLAYGROUNDS[id]) paths.push(`/investigations/${id}/playground`);
    return paths.map((path) => [path, "2026-10-11"] as const);
  });
  // Only include dates for pages with a known material edit. Avoid refreshing every
  // URL on each deploy, which would make the sitemap's update hints unreliable.
  const lastModified: Record<string, string> = {
    "/": "2026-10-11",
    "/system-design-interview": "2026-10-11",
    "/investigations": "2026-10-11",
    "/downloads/system-design-interview-questions-and-answers.pdf": "2026-10-11",
    "/capacity-estimator": "2026-10-11",
    "/concepts/server-push": "2026-10-11",
    "/system-design-interview/design-llm-inference": "2026-10-11",
    "/companies/google": "2026-10-11",
    "/companies/amazon": "2026-10-11",
    "/companies/uber": "2026-10-11",
    ...Object.fromEntries(rideDispatchPaths.map((path) => [path, "2026-10-11"])),
    ...Object.fromEntries(updatedInvestigationTitles),
  };
  const paths = [
    "/",
    "/system-design-interview",
    "/system-design-interview/worksheet",
    "/downloads/system-design-interview-practice-sheet.pdf",
    "/downloads/system-design-interview-questions-and-answers.pdf",
    "/system-design-interview/scorecard",
    "/downloads/system-design-interview-scorecard.pdf",
    "/system-design-interview/design-youtube",
    "/system-design-interview/design-llm-inference",
    "/system-design-interview/design-rag-system",
    "/system-design-interview/design-ai-agent",
    "/system-design-mock-interview",
    "/capacity-estimator",
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
  return paths.map((path) => ({
    url: `${SITE_URL}${path}`,
    ...(lastModified[path] ? { lastModified: lastModified[path] } : {}),
  }));
}
