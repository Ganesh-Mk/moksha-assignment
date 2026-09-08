/**
 * Server-Sent Events parsing, as a pure function.
 *
 * This is the third piece of parsing in this codebase that started life inline inside a component
 * and moved out here — after the assistant's markdown and the chart's curve. The pattern is
 * consistent enough to state as a rule: **a parser inside a component is a parser nobody can
 * test**, and the bugs it hides are the quiet kind, where the network tab shows the right bytes
 * and the screen shows nothing.
 *
 * The one rule worth naming: a chunk from the network can end anywhere, including halfway through
 * a record or between the two newlines that terminate it. So the caller keeps a buffer, hands the
 * whole thing over each time, and gets back the records that are definitely complete plus the
 * fragment to carry forward. Dropping that fragment loses whichever event straddled the boundary
 * — and the interesting events are the ones at the end of a stream.
 */

export interface SseParseResult<T> {
  /** Records that were terminated by a blank line, already JSON-parsed. */
  events: T[];
  /** The unterminated tail, to prepend to the next chunk. */
  rest: string;
}

/**
 * Split a buffer into complete SSE records.
 *
 * Malformed JSON in one record is skipped rather than thrown: one bad record must not kill a
 * stream that is still delivering good ones.
 */
export function parseSseBuffer<T>(buffer: string): SseParseResult<T> {
  // Normalise CRLF first: the spec allows \r\n, \n or \r as a line terminator, and a proxy that
  // rewrites them would otherwise make every record look unterminated.
  const normalised = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const parts = normalised.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: T[] = [];

  for (const record of parts) {
    for (const line of record.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice("data:".length).trim();
      if (!payload) continue;
      try {
        events.push(JSON.parse(payload) as T);
      } catch {
        // A record we cannot read is a record we ignore.
      }
    }
  }

  return { events, rest };
}

/**
 * Read a `fetch` body to completion, yielding each event as it arrives.
 *
 * The `flush` at the end is not belt-and-braces. A server that ends its response without a
 * trailing blank line leaves the final record in the buffer, and the final record is the one
 * carrying whatever the turn concluded with.
 */
export async function* readSseStream<T>(
  body: ReadableStream<Uint8Array<ArrayBufferLike>>,
): AsyncGenerator<T> {
  const reader = body.getReader();
  // A TextDecoder in streaming mode rather than `pipeThrough(new TextDecoderStream())`: a
  // multi-byte character (₹, in every price this thing streams) can be split across two chunks,
  // and `{ stream: true }` is what holds the partial bytes until the rest arrives.
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const { events, rest } = parseSseBuffer<T>(buffer);
    buffer = rest;
    for (const event of events) yield event;
  }

  // Flush whatever the stream ended on, terminated or not. `decoder.decode()` with no argument
  // releases any bytes the decoder was still holding for a partial character.
  const { events } = parseSseBuffer<T>(`${buffer}${decoder.decode()}\n\n`);
  for (const event of events) yield event;
}
