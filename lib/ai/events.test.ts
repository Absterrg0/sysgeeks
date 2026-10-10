import { describe, expect, it } from "vitest";
import type { AiEvent } from "./events";
import { readNdjson } from "./events";

const encoder = new TextEncoder();

function streamOf(chunks: string[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
  );
}

async function collect(res: Response): Promise<AiEvent[]> {
  const events: AiEvent[] = [];
  await readNdjson(res, (event) => events.push(event));
  return events;
}

describe("readNdjson", () => {
  it("parses events whose lines are split across chunks", async () => {
    const events = await collect(
      streamOf([
        '{"type":"progress","ste',
        'p":"Reading repo","runId":"run_1"}\n{"type":"res',
        'ult","runId":"run_1","data":{"ok":true}}',
      ]),
    );
    expect(events).toEqual([
      { type: "progress", step: "Reading repo", runId: "run_1" },
      { type: "result", runId: "run_1", data: { ok: true } },
    ]);
  });

  it("splits a multi-byte character across chunks", async () => {
    const bytes = encoder.encode('{"type":"progress","step":"héllo"}\n');
    const res = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes.slice(0, 27));
          controller.enqueue(bytes.slice(27));
          controller.close();
        },
      }),
    );
    expect(await collect(res)).toEqual([{ type: "progress", step: "héllo" }]);
  });

  it("handles a final line without a trailing newline and skips blank lines", async () => {
    const events = await collect(
      streamOf(['{"type":"progress","step":"a"}\n\n   \n{"type":"error","code":"timeout","message":"m","refunded":true}']),
    );
    expect(events).toEqual([
      { type: "progress", step: "a" },
      { type: "error", code: "timeout", message: "m", refunded: true },
    ]);
  });
});
