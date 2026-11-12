"use client";

import { useState } from "react";
import { defendQuestions } from "@/lib/domain/defend";
import type { PlayModel, Workload } from "@/lib/domain/playground";

/**
 * The follow-ups an interviewer asks once a design looks done. Pick an answer and the playground's own model
 * says what actually happens, with its numbers. Nothing is graded or stored: it is practice at predicting.
 */
export function DefendPanel({
  model,
  workload,
  traffic,
  onPick,
  intro,
}: {
  model: PlayModel;
  workload: Workload;
  traffic: number;
  onPick: (id: string) => void;
  intro: string;
}) {
  const questions = defendQuestions(model, workload, traffic);
  // Answers are kept against the question and its correct answer, so a change that moves the answer asks again.
  const [picked, setPicked] = useState<Record<string, string>>({});
  if (questions.length === 0) return null;
  const answered = questions.filter((q) => picked[`${q.id}:${q.answer}`]).length;
  const right = questions.filter((q) => picked[`${q.id}:${q.answer}`] === q.answer).length;

  return (
    <section aria-labelledby="defend" className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="defend" className="font-display text-[1.25rem] tracking-[-0.015em]">
          Defend it
        </h2>
        <p className="font-mono text-[0.75rem] text-ink-3" aria-live="polite">
          {answered === 0 ? `${questions.length} follow-ups` : `${right} of ${answered} predicted`}
        </p>
      </div>
      <p className="mt-1.5 max-w-[72ch] text-[0.875rem] leading-relaxed text-ink-2">{intro}</p>
      <ol className="plate mt-3">
        {questions.map((q, i) => {
          const key = `${q.id}:${q.answer}`;
          const choice = picked[key];
          const correct = choice === q.answer;
          return (
            <li key={key} className="plate-row px-4 py-3.5 sm:px-5">
              <fieldset>
                <legend className="flex gap-2.5 text-[0.9375rem] font-medium leading-snug">
                  <span className="font-mono text-[0.75rem] text-ink-3">{i + 1}</span>
                  {q.prompt}
                </legend>
                <div className="mt-2 pl-5">
                  {q.options.map((o) => {
                    const isAnswer = choice !== undefined && o.id === q.answer;
                    const isWrongPick = choice === o.id && !correct;
                    return (
                      <label
                        key={o.id}
                        className={`ticket-option cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-solid ${
                          isAnswer ? "text-ink" : isWrongPick ? "text-signal-gap" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name={key}
                          value={o.id}
                          checked={choice === o.id}
                          disabled={choice !== undefined}
                          onChange={() => setPicked({ ...picked, [key]: o.id })}
                          className="sr-only"
                        />
                        <i
                          aria-hidden="true"
                          className={isAnswer ? "!bg-accent-solid" : choice === o.id ? "!bg-mark-gap" : ""}
                        />
                        <span>
                          {o.label}
                          {isAnswer && <span className="sr-only"> (what happens)</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {choice !== undefined && (
                <div className="mt-2 pl-5 text-[0.875rem] leading-relaxed" aria-live="polite">
                  <p className={correct ? "text-signal-strong" : "text-ink-2"}>
                    <span className="font-medium">{correct ? "Right." : "Not quite."}</span>{" "}
                    <span className="text-ink-2">{q.explain}</span>
                  </p>
                  <p className="mt-1.5 flex flex-wrap gap-1.5">
                    {q.componentIds.map((id) => (
                      <button key={id} type="button" className="btn btn-ghost btn-sm -ml-2.5" onClick={() => onPick(id)}>
                        Show the part
                      </button>
                    ))}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        const next = { ...picked };
                        delete next[key];
                        setPicked(next);
                      }}
                    >
                      Ask again
                    </button>
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[0.75rem] text-ink-3">
        Answered by the same model as everything above, on the design as it stands. Change the design and the answers
        change with it.
      </p>
    </section>
  );
}
