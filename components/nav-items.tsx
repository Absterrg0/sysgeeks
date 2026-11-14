import type { ReactNode } from "react";
import { CapacityIcon, CompaniesIcon, ConceptsIcon, InvestigationsIcon, ProjectsIcon, UnderstandingIcon } from "@/components/icons";

export type NavItem = { href: string; label: string; icon: ReactNode; description: string };

/** Pages linked from the footer only. */
export const ABOUT: NavItem[] = [
  { href: "/about", label: "About", icon: null, description: "How the practice is built" },
  {
    href: "/system-design-interview",
    label: "Interview guide",
    icon: null,
    description: "How the system design interview works",
  },
  { href: "/ai", label: "AI use", icon: null, description: "Bring your own key: what AI does here and what is sent" },
];

/** Footer-only legal pages. */
export const LEGAL: NavItem[] = [
  { href: "/legal/privacy", label: "Privacy", icon: null, description: "What is stored and who processes it" },
  { href: "/legal/terms", label: "Terms", icon: null, description: "The terms of use" },
];

export const EXAMPLES: NavItem = {
  href: "/projects/examples",
  label: "Examples",
  icon: <ProjectsIcon />,
  description: "See worked system designs and their components",
};

export const COMPANIES: NavItem = {
  href: "/companies",
  label: "Companies",
  icon: <CompaniesIcon />,
  description: "One idea each, in their own words",
};

export const PLAYGROUND: NavItem = {
  href: "/system-design-playground",
  label: "Playground",
  icon: <CapacityIcon />,
  description: "Change a live system, turn up traffic, break parts",
};

/** The product: systems to work on, the mechanisms underneath, and coming back to what you learned. */
export const LEARN: NavItem[] = [
  PLAYGROUND,
  {
    href: "/investigations",
    label: "Systems",
    icon: <InvestigationsIcon />,
    description: "15 interactive system design interview questions with worked answers",
  },
  {
    href: "/system-design-mock-interview",
    label: "Mock interview",
    icon: <UnderstandingIcon />,
    description: "Timed 30, 45, or 60-minute system design practice",
  },
  EXAMPLES,
  { href: "/capacity-estimator", label: "Capacity calculator", icon: <CapacityIcon />, description: "Estimate QPS, storage and bandwidth" },
  { href: "/concepts", label: "Concepts", icon: <ConceptsIcon />, description: "The mechanisms, and how they fail" },
  {
    href: "/review",
    label: "Review",
    icon: <UnderstandingIcon />,
    description: "What is due, timed sessions, drills, and where you stand",
  },
];

export const YOURS: NavItem[] = [
  {
    href: "/projects",
    label: "Your systems",
    icon: <ProjectsIcon />,
    description: "Bring a system you built and get asked about it",
  },
];

/** The top bar on wide screens: only the places people go most. Everything else is in the menu and footer. */
export const PRIMARY: NavItem[] = LEARN.filter((item) =>
  ["/system-design-playground", "/investigations", "/system-design-mock-interview", "/concepts"].includes(item.href),
);
