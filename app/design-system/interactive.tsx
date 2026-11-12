"use client";

import { useState } from "react";
import { StreamStatus } from "@/components/ai";
import { Toaster, useToast } from "@/components/feedback";

export function ToastDemo() {
  const { toast } = useToast();
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => toast({ message: "Answer recorded.", tone: "success" })}
        >
          Success toast
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => toast({ message: "Draft failed. Not charged.", tone: "error" })}
        >
          Error toast
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            toast({
              message: "Draft ready: 9 components, 11 flows.",
              tone: "success",
              action: { label: "Open draft", href: "/projects" },
            })
          }
        >
          Toast with action
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => toast({ message: "Saved in this browser." })}>
          Neutral toast
        </button>
      </div>
      <Toaster />
    </>
  );
}

export function StreamDemo() {
  const [stopped, setStopped] = useState(false);
  if (stopped) return <p className="text-small text-ink-3">Stopped.</p>;
  return (
    <StreamStatus
      message="Reading your README… found 7 components"
      elapsed="0:12"
      onStop={() => setStopped(true)}
    />
  );
}
