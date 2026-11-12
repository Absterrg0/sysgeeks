"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { KeyIcon } from "@/components/icons";
import { PROVIDERS } from "@/lib/ai/providers";
import { useAiKey } from "@/lib/store/ai-key-store";
import { onOpenAiKeySettings } from "./events";

const AiKeyDialog = dynamic(() => import("./ai-key-dialog").then((module) => module.AiKeyDialog));

/** The header's key button: opens the key settings, and lights when a key is saved. */
export function AiKeyButton() {
  const saved = useAiKey();
  const [open, setOpen] = useState(false);

  useEffect(() => onOpenAiKeySettings(() => setOpen(true)), []);

  const label = saved ? `AI key: ${PROVIDERS[saved.provider].label}, saved` : "Add your AI key";
  return (
    <>
      <button
        type="button"
        className="knob relative size-10 lg:size-8"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <KeyIcon size={17} />
        {saved && <span className="led led-accent absolute top-2 right-2 size-1.5 lg:top-1 lg:right-1" aria-hidden="true" />}
      </button>
      {open && <AiKeyDialog onClose={() => setOpen(false)} />}
    </>
  );
}
