import { describe, expect, it } from "vitest";

/**
 * A lint the linters do not do.
 *
 * Tailwind v4 spells "the value of this custom property" as `duration-(--dur-slow)`. Written with
 * square brackets instead, it emits the token *name* as the value:
 *
 *     transition-duration: --dur-slow;     ← invalid, silently discarded by every browser
 *
 * Nothing complains. The build succeeds, the class is in the HTML, the declaration is dropped, and
 * the property falls back to Tailwind's default. This shipped: 29 utilities across 18 files were
 * writing invalid CSS, so no transition in the application ran at the duration its token said, and
 * the visible symptom was a product image that snapped on hover instead of easing.
 *
 * That is precisely the failure a token layer exists to prevent — a value defined in one place and
 * not actually reaching the pixel — so it is worth a test rather than a note.
 *
 * `import.meta.glob` rather than `node:fs`: it is resolved by Vite at transform time, so the test
 * needs no `@types/node` and no path arithmetic that behaves differently on Windows.
 *
 * Every example below is assembled from fragments rather than written out. Tailwind's scanner
 * reads this file like any other, and a literal example would be compiled into the stylesheet as
 * the very invalid rule this test exists to forbid.
 */

const SOURCES = import.meta.glob("../**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Matches a utility passing a bare token where a value belongs. */
const BARE_TOKEN = /\b[a-z][a-z-]*-\[--[a-z-]+\]/g;

const OPEN = "-[";
const CLOSE = "]";
const example = (utility: string, token: string) => `${utility}${OPEN}${token}${CLOSE}`;

describe("Tailwind custom-property utilities", () => {
  it("never pass a token name where a value is expected", () => {
    const offenders: string[] = [];

    for (const [path, source] of Object.entries(SOURCES)) {
      // Skip this file: it necessarily talks about the pattern it forbids.
      if (path.includes("design-tokens.test")) continue;

      for (const match of String(source).match(BARE_TOKEN) ?? []) {
        offenders.push(`${path}: ${match} — write ${match.replace(/-\[(--[a-z-]+)\]/, "-($1)")}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("finds the mistake when it is there", () => {
    // Guards the guard: a regex that matched nothing would let the test above pass for ever.
    const wrong = example("duration", "--dur-fast");
    expect(wrong.match(BARE_TOKEN)).toEqual([wrong]);

    // The correct spelling, and a bracket holding a real value, are both left alone.
    expect("duration-(--dur-fast)".match(BARE_TOKEN)).toBeNull();
    expect("shadow-[0_0_0_3px_var(--accent-ring)]".match(BARE_TOKEN)).toBeNull();
  });
});
