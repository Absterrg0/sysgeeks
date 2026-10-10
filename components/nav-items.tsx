import type { ReactNode } from "react";
import { CompaniesIcon, ConceptsIcon, InvestigationsIcon, ProjectsIcon, UnderstandingIcon } from "@/components/icons";

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
  { href: "/ai", label: "AI use", icon: null, description: "What AI does here and what is sent" },
];

/** Footer-only legal pages. */
export const LEGAL: NavItem[] = [
  { href: "/legal/privacy", label: "Privacy", icon: null, description: "What is stored and who processes it" },
  { href: "/legal/terms", label: "Terms", icon: null, description: "The terms of use" },
  { href: "/legal/refunds", label: "Refunds", icon: null, description: "When credits and purchases are refunded" },
];

export const PRICING: NavItem = {
  href: "/#pricing",
  label: "Pricing",
  icon: null,
  description: "Credits and what they buy",
};

export const EXAMPLES: NavItem = {
  href: "/projects/examples",
  label: "Examples",
  icon: null,
  description: "Finished projects to read",
};

export const COMPANIES: NavItem = {
  href: "/companies",
  label: "Companies",
  icon: <CompaniesIcon />,
  description: "One idea each, in their own words",
};

/** The product: systems to work on, the mechanisms underneath, and coming back to what you learned. */
export const LEARN: NavItem[] = [
  {
    href: "/investigations",
    label: "Systems",
    icon: <InvestigationsIcon />,
    description: "Real systems to learn, play with and break",
  },
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
