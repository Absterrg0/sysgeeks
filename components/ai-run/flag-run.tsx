"use client";

import { type FormEvent, useId, useState } from "react";

export type FlagOutcome = { refunded: true; credits: number } | { refunded: false };

const MAX_REASON = 1000;

/** "This is wrong about my system": asks for a reason, then shows the refund. The caller sends the request. */
export function FlagRun({ onFlag }: { onFlag: (reason: string) => Promise<FlagOutcome> }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [outcome, setOutcome] = useState<FlagOutcome | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFailed(false);
    try {
      setOutcome(await onFlag(reason.trim()));
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  if (outcome) {
    return outcome.refunded ? (
      <p className="text-small text-ink-2">
        Refunded {outcome.credits} {outcome.credits === 1 ? "credit" : "credits"}. Thanks for telling us.
      </p>
    ) : (
      <p className="text-small text-ink-2">
        This run can’t be refunded again. Email support and we’ll take a look.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        This is wrong about my system
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label htmlFor={id} className="eyebrow block">
        What’s wrong?
      </label>
      <textarea
        id={id}
        className="field resize-y"
        rows={3}
        maxLength={MAX_REASON}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      {failed && (
        <p role="alert" className="text-small text-ink-2">
          Couldn’t send that. Try again.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending || !reason.trim()}>
          {pending ? "Sending…" : "Send"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
