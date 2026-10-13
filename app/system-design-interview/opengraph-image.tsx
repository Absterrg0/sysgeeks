import { card, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";

export const alt = "A 45-minute system design interview framework, six skills, and a one-week practice plan";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return card({
    label: "Interview guide",
    title: "System design interview preparation",
    body: "A 45-minute framework, six skills to practise, and a one-week schedule.",
    facts: ["45-minute plan", "7-day schedule", "Free practice"],
  });
}
