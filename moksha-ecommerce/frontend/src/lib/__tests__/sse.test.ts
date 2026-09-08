import { describe, expect, it } from "vitest";

import { parseSseBuffer, readSseStream } from "@/lib/sse";

interface Event {
  delta?: string;
  cart?: { slug: string }[];
  done?: boolean;
}

/** A stream that hands out exactly the chunks given, to reproduce awkward network boundaries. */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

const collect = async (chunks: string[]) => {
  const out: Event[] = [];
  for await (const event of readSseStream<Event>(streamOf(chunks))) out.push(event);
  return out;
};

describe("parseSseBuffer", () => {
  it("returns complete records and keeps the unterminated tail", () => {
    const { events, rest } = parseSseBuffer<Event>('data: {"delta":"a"}\n\ndata: {"delta":"b"}');

    expect(events).toEqual([{ delta: "a" }]);
    expect(rest).toBe('data: {"delta":"b"}');
  });

  it("skips a malformed record without losing the ones around it", () => {
    // One bad record must not kill a stream that is still delivering good ones.
    const { events } = parseSseBuffer<Event>(
      'data: {"delta":"a"}\n\ndata: {not json\n\ndata: {"delta":"b"}\n\n',
    );

    expect(events).toEqual([{ delta: "a" }, { delta: "b" }]);
  });

  it("tolerates CRLF, which a proxy may introduce", () => {
    const { events } = parseSseBuffer<Event>('data: {"delta":"a"}\r\n\r\n');

    expect(events).toEqual([{ delta: "a" }]);
  });
});

describe("readSseStream", () => {
  it("reassembles a record split across chunk boundaries", async () => {
    // The bug this guards: a chunk can end anywhere, including inside the JSON.
    const events = await collect(['data: {"de', 'lta":"hello"}\n', "\n"]);

    expect(events).toEqual([{ delta: "hello" }]);
  });

  it("does not lose the last record when the stream ends without a blank line", async () => {
    // The last record is the one carrying whatever the turn concluded with — for this app, the
    // cart the agent just filled. Dropping it shows the customer a reply saying their cart was
    // updated, with an empty cart behind it.
    const events = await collect(['data: {"delta":"hi"}\n\ndata: {"cart":[{"slug":"gel"}]}']);

    expect(events).toEqual([{ delta: "hi" }, { cart: [{ slug: "gel" }] }]);
  });

  it("keeps a cart event that arrives in the same chunk as done", async () => {
    const events = await collect([
      'data: {"cart":[{"slug":"gel"}]}\n\ndata: {"done":true}\n\n',
    ]);

    expect(events).toEqual([{ cart: [{ slug: "gel" }] }, { done: true }]);
  });

  it("handles a turn arriving one byte at a time", async () => {
    const payload = 'data: {"delta":"a"}\n\ndata: {"cart":[{"slug":"gel"}]}\n\ndata: {"done":true}\n\n';
    const events = await collect([...payload]);

    expect(events).toEqual([{ delta: "a" }, { cart: [{ slug: "gel" }] }, { done: true }]);
  });

  it("yields nothing for an empty stream rather than throwing", async () => {
    expect(await collect([])).toEqual([]);
    expect(await collect([""])).toEqual([]);
  });
});
