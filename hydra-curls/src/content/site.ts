/**
 * Copy that appears once and belongs to no particular section list.
 *
 * Every string the page renders lives under src/content/. Sections import and map over these
 * rather than embedding text, which is what makes each section component a layout concern only.
 *
 * Placeholder copy in the Figma file ("Lorem Ipsum", the thrice-repeated hyaluronic-acid
 * sentence) is reproduced verbatim. The task is visual fidelity, so rewriting it would break
 * the very diff the work is judged against.
 */

export const site = {
  brand: 'Parachute Advanced',
  product: 'Hydra Curls',
  announcement: '5 Essential Products for Perfect Curls',
} as const

export const hero = {
  /**
   * Two designed lines. The break is authored, not incidental — Figma sets this as one
   * 1098px-wide centred text node that wraps after "results." — so it is reproduced from `md`
   * up and allowed to reflow naturally below that.
   */
  headlineLines: ['Pure ingredients. Real results.', 'Every drop matters.'],
} as const

/** Repeated across both benefit cards and the first promise block, exactly as authored. */
export const HYALURONIC_SENTENCE =
  'Hyaluronic Acid acts like a magnet for moisture, drawing hydration into each strand.'

export const HYALURONIC_PARAGRAPH = `${HYALURONIC_SENTENCE} ${HYALURONIC_SENTENCE}${HYALURONIC_SENTENCE}`
