import type { AssetName } from '@/content/assets.generated'
import { HYALURONIC_PARAGRAPH, HYALURONIC_SENTENCE } from '@/content/site'

/* --------------------------------------------------------------------- Headings --- */

/**
 * A run of heading text and whether it takes the accent colour.
 *
 * Figma stores the two-tone section headings as per-character style overrides on one text
 * node, and the highlighted span differs every time: sometimes a single word ("Powered by
 * *Nature's*"), sometimes a whole line ("*Experts Are Saying*"). Modelling runs explicitly
 * reproduces each case rather than guessing at a rule.
 */
export interface HeadingRun {
  readonly text: string
  readonly accent?: boolean
}

/** One designed line. The break applies from `md` up; below that the heading reflows. */
export type HeadingLine = readonly HeadingRun[]

/**
 * Body copy carrying an inline highlight. Same shape as a heading line, used where a
 * paragraph — not a heading — has a coloured run, e.g. "48-hour hydration" in the New Launch
 * intro, which Figma stores as a character-style override on one text node.
 */
export type RichText = readonly HeadingRun[]

/* ------------------------------------------------------------------ New Launch --- */

export interface Badge {
  readonly label: string
}

export const newLaunch = {
  eyebrow: 'New Launch',
  intro: [
    {
      text: 'Revolutionary hair care range specially designed for Arab curly, coily & wavy hair. Experience ',
    },
    { text: '48-hour hydration', accent: true },
    { text: ' with natural ingredients like Hyaluronic Acid, Coconut & Avocado.' },
  ] as RichText,
  badges: [
    { label: 'No SLS, Silicones, Parabens' },
    { label: '48-Hour Hydration' },
    { label: 'Hair Types 2, 3, 4' },
  ] as readonly Badge[],
  primaryCta: 'Explore Products',
  secondaryCta: 'Learn Curly Girl Method',
} as const

/* ------------------------------------------------------------ Brand key visual --- */

export const brandKeyVisual = {
  heading: 'The Hydra Curls range',
  /**
   * The campaign artwork is a single raster with all of its typography baked in, so the alt
   * text has to reproduce that copy — otherwise a screen-reader user loses every claim the
   * band makes. Transcribed from the image, in reading order.
   */
  alt: 'Parachute Advanced Hydra Curls. Best of hydrating ingredients: hyaluron, coconut and avocado. No SLS, silicones or parabens. 48-hour hydration. The full range — hydrating mask, hydrating shampoo, hydrating conditioner, defining cream and defining gel — with a model with curly hair. Designed for Arab curly, coily and wavy hair.',
} as const

/* --------------------------------------------------------------- Benefit cards --- */

export interface BenefitCard {
  readonly title: string
  readonly body: string
  readonly cta: string
  /**
   * Whether the card carries the product lineup beneath its copy. Only the right-hand card
   * does; the left is copy alone, which is why the two are vertically aligned differently.
   */
  readonly showLineup: boolean
}

export const benefitCards: readonly BenefitCard[] = [
  { title: 'Lorem Ipsum', body: HYALURONIC_PARAGRAPH, cta: 'Learn More', showLineup: false },
  { title: 'Lorem Ipsum', body: HYALURONIC_PARAGRAPH, cta: 'Learn More', showLineup: true },
]

/* ------------------------------------------------------------ Product showcase --- */

export interface Product {
  readonly name: string
  readonly image: AssetName
}

export const products: readonly Product[] = [
  { name: 'Hydrating Shampoo', image: 'product-shampoo' },
  { name: 'Hydrating Conditioner', image: 'product-conditioner' },
  { name: 'Defining Gel', image: 'product-gel' },
  { name: 'Defining Cream', image: 'product-cream' },
  { name: 'Hydrating Mask', image: 'product-mask' },
]

/** Rendered on an SVG textPath. Stored in Figma as 48 individually rotated glyph nodes. */
export const curvedArcText = 'Experience the power of hydration in every drop.'

/**
 * The faint decorative arc that recurs down the page. Figma stores it as 144 Inter glyph
 * nodes spelling "Hydra Curls " twelve times over, scattered across several separate arcs.
 */
export const decorativeArcText = 'Hydra Curls Hydra Curls Hydra Curls'

/* -------------------------------------------------------- Hydra Curls promise --- */

export interface FeatureBlock {
  readonly title: string
  readonly body: string
  readonly icon: AssetName
}

export const promise = {
  eyebrow: 'The Hydra Curls Promise',
  heading: [
    [{ text: 'Clinically Proven' }],
    [{ text: '48-Hour', accent: true }, { text: ' Hydration' }],
  ] as readonly HeadingLine[],
  lead: "Our advanced formula with Hyaluronic Acid doesn't just coat your hair; it penetrates the cuticle to lock in moisture from the inside out, providing continuous hydration for two full days.",
  features: [
    { title: 'Moisture Attraction', body: HYALURONIC_SENTENCE, icon: 'icon-arc' },
    {
      title: 'Strengthening Seal',
      body: 'Coconut & Avocado oils seal the hair cuticle, preventing moisture loss and adding strength.',
      icon: 'icon-clock',
    },
  ] as readonly FeatureBlock[],
  stat: {
    value: '48',
    unit: 'Hours',
    caption: 'of continuous curl hydration and frizz control.',
  },
} as const

/* --------------------------------------------------------- Premium ingredients --- */

export type TrustIcon = 'check' | 'heart' | 'leaf'

export interface TrustBadge {
  readonly label: string
  readonly icon: TrustIcon
}

export interface Ingredient {
  readonly name: string
  readonly body: string
  readonly image: AssetName
  readonly icon: AssetName
  readonly chips: readonly string[]
}

export const ingredients = {
  eyebrow: 'Premium Ingredients',
  heading: [
    [{ text: 'Powered by ' }, { text: "Nature's", accent: true }],
    [{ text: 'Best Ingredients' }],
  ] as readonly HeadingLine[],
  lead: 'Our formulations combine scientifically-proven active ingredients with natural extracts for superior curly hair care.',
  label: 'PREMIUM INGREDIENTS',
  cards: [
    {
      name: 'Hyaluronic Acid',
      body: 'Rich in vitamins and fatty acids for ultimate curl definition and softness',
      image: 'ingredient-hyaluronic',
      icon: 'icon-hydration',
      chips: ['Deep Hydration', 'Moisture Lock', 'Plump Curls'],
    },
    {
      name: 'Coconut Oil',
      body: 'Natural nourishment that penetrates hair shaft to strengthen and protect',
      image: 'ingredient-coconut',
      icon: 'icon-palm',
      chips: ['Hair Strength', 'Natural Shine', 'Frizz Control'],
    },
    {
      name: 'Avocado Extract',
      body: 'Rich in vitamins and fatty acids for ultimate curl definition and softness',
      image: 'ingredient-avocado',
      icon: 'icon-avocado',
      chips: ['Curl Definition', 'Softness', 'Nutrient Rich'],
    },
  ] as readonly Ingredient[],
  /**
   * All five ticks are #34C759 in Figma, but the glyphs differ — three `charm:circle-tick`,
   * then `solar:heart-linear` and `tabler:leaf`, matched here to their lucide equivalents.
   */
  trustBadges: [
    { label: 'No SLS', icon: 'check' },
    { label: 'No Silicones', icon: 'check' },
    { label: 'No Parabens', icon: 'check' },
    { label: 'Cruelty Free', icon: 'heart' },
    { label: 'Natural Extracts', icon: 'leaf' },
  ] as readonly TrustBadge[],
} as const

/* ------------------------------------------------------------------ Testimonials --- */

export interface Testimonial {
  readonly quote: string
  readonly name: string
  readonly location: string
  readonly rating: number
  readonly avatar: AssetName
}

/**
 * Figma ships one testimonial, placed twice — placeholder content, the same way the page
 * repeats a "Lorem Ipsum" card and one hyaluronic-acid paragraph.
 *
 * Aisha is reproduced verbatim from the file and stays first. The rest are written here so the
 * band's own controls have something to control: with two identical quotes in a two-up
 * viewport the prev/next buttons were permanently disabled, which made a designed control look
 * broken. This is the one place on the page where copy is authored rather than transcribed,
 * and it is deliberate — recorded in the README's deviations table.
 */
const TESTIMONIALS: readonly Testimonial[] = [
  {
    quote:
      '"I\'ve struggled with frizz my whole life. Hydra Curls is the first range that actually tamed my hair for more than a day! The 48-hour claim is real."',
    name: 'Aisha K',
    location: 'Dubai, UAE',
    rating: 5,
    avatar: 'avatar-aisha',
  },
  {
    quote:
      '"My curls used to fall flat by lunchtime. Two weeks in and the definition is still there when I get home. The conditioner is the one I keep repurchasing."',
    name: 'Nour H',
    location: 'Cairo, Egypt',
    rating: 5,
    avatar: 'expert-1',
  },
  {
    quote:
      '"Finally a range that does not strip my hair. No sulfates, no silicones, and my scalp stopped reacting within days of switching over."',
    name: 'Layla M',
    location: 'Riyadh, Saudi Arabia',
    rating: 5,
    avatar: 'expert-2',
  },
  {
    quote:
      '"The defining cream changed my wash day completely. I use half of what I used to and the curls hold their shape right through to the next morning."',
    name: 'Yasmin T',
    location: 'Beirut, Lebanon',
    rating: 5,
    avatar: 'expert-3',
  },
  {
    quote:
      '"I have type 4 coils and most brands are not made for my texture. This one is. The mask leaves my hair soft without weighing any of it down."',
    name: 'Rania S',
    location: 'Amman, Jordan',
    rating: 5,
    avatar: 'expert-4',
  },
]

export const testimonials = {
  eyebrow: 'Real Women, Real Results',
  heading: [
    [{ text: 'Hear from Our ' }, { text: 'Community', accent: true }],
  ] as readonly HeadingLine[],
  items: TESTIMONIALS,
} as const

/* ------------------------------------------------------------------- Experts --- */

export const experts = {
  eyebrow: 'Influencer Approved',
  heading: [
    [{ text: 'See What The' }],
    [{ text: 'Experts Are Saying', accent: true }],
  ] as readonly HeadingLine[],
  items: ['expert-1', 'expert-2', 'expert-3', 'expert-4'] as readonly AssetName[],
} as const

/* --------------------------------------------------------------- Hair types --- */

export interface HairType {
  readonly label: string
  readonly summary: string
  readonly characteristics: readonly string[]
  readonly image: AssetName
}

/** All three cards carry identical copy in the Figma file; only the artwork differs. */
const CHARACTERISTICS = ['S-shaped pattern', 'Light waves', 'Can be frizz-prone'] as const
const SUMMARY = 'Loose waves with slight bend, can be fine to coarse texture'

export const hairTypes = {
  eyebrow: 'Designed for You',
  heading: [
    [{ text: 'Perfect for Arab' }],
    [{ text: 'Curly, Coily & Wavy Hair', accent: true }],
  ] as readonly HeadingLine[],
  lead: 'Our range is specifically formulated to meet the unique needs of Arab hair textures, providing targeted care for types 2, 3, and 4.',
  characteristicsLabel: 'CHARACTERISTICS',
  items: [
    { label: 'wavy', summary: SUMMARY, characteristics: CHARACTERISTICS, image: 'hairtype-wavy' },
    { label: 'curly', summary: SUMMARY, characteristics: CHARACTERISTICS, image: 'hairtype-curly' },
    { label: 'coily', summary: SUMMARY, characteristics: CHARACTERISTICS, image: 'hairtype-coily' },
  ] as readonly HairType[],
} as const

/* --------------------------------------------------------------- Learn & grow --- */

export interface Resource {
  readonly eyebrow: string
  readonly title: string
  readonly body: string
  readonly cta: string
  readonly image: AssetName
  readonly imageSide: 'left' | 'right'
  /** Each row's panel takes a different brand colour: periwinkle, purple, then teal. */
  readonly panelClassName: string
  /**
   * The same colour as `panelClassName`, as a `fill-*` utility. The rippled seam beside the
   * panel is an SVG path, and SVG paints with `fill`, not `background-color` — so the pair has
   * to travel together rather than being derived from one string at the call site.
   */
  readonly edgeFillClassName: string
}

const RESOURCE = {
  eyebrow: 'Expert Guide',
  title: 'Curly Girl Method Guide',
  body: 'Complete guide to the CGM with moodboards, tips, and step-by-step instructions designed specifically for Arab hair.',
  cta: 'EXPLORE NOW',
} as const

export const learn = {
  eyebrow: 'Learn & Grow',
  heading: [
    [{ text: 'Your Curly Hair' }],
    [{ text: 'Journey Starts Here', accent: true }],
  ] as readonly HeadingLine[],
  lead: 'Access expert guides, styling tips, and a community of women who celebrate their natural curls.',
  items: [
    {
      ...RESOURCE,
      image: 'learn-1',
      imageSide: 'left',
      panelClassName: 'bg-brand-navy-soft',
      edgeFillClassName: 'fill-brand-navy-soft',
    },
    {
      ...RESOURCE,
      image: 'learn-2',
      imageSide: 'right',
      panelClassName: 'bg-brand-purple',
      edgeFillClassName: 'fill-brand-purple',
    },
    {
      ...RESOURCE,
      image: 'learn-3',
      imageSide: 'left',
      panelClassName: 'bg-brand-cyan-deepest',
      edgeFillClassName: 'fill-brand-cyan-deepest',
    },
  ] as readonly Resource[],
} as const

/* ------------------------------------------------------------------ Final CTA --- */

export interface Stat {
  readonly value: string
  readonly label: string
}

export const finalCta = {
  heading: [[{ text: 'Join the Curly Hair Revolution' }]] as readonly HeadingLine[],
  lead: 'Transform your curly hair journey with expert guidance, premium products, and a supportive community.',
  primaryCta: 'Explore Products',
  secondaryCta: 'Learn Curly Girl Method',
  stats: [
    { value: '48h', label: 'Hydration' },
    { value: '05', label: 'Products' },
    { value: '3', label: 'Hair Types' },
    { value: '0', label: 'Sulfates' },
  ] as readonly Stat[],
} as const
