"use client";

import { useRouter } from "next/navigation";
import type { ExampleProject } from "@/lib/domain/content";
import { instantiateExample } from "@/lib/domain/example-project";
import { uniqueSlug } from "@/lib/domain/layout";
import { saveProject, useLearnerState } from "@/lib/store/learner-store";

/** Receives one example as a prop. The examples library is never imported here. */
export function PracticeButton({ example }: { example: ExampleProject }) {
  const state = useLearnerState();
  const router = useRouter();

  function practise() {
    const taken = state?.projects.map((p) => p.id) ?? [];
    const project = instantiateExample(example, uniqueSlug(example.id, taken), new Date().toISOString());
    saveProject(project);
    router.push(`/projects/${project.id}`);
  }

  return (
    <button type="button" className="btn btn-primary" disabled={!state} onClick={practise}>
      Practise on this system
    </button>
  );
}
