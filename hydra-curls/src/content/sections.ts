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

/* ------------------------------------------------------------------ New Launch --- */

export interface Badge {
  readonly label: string
}

export const newLaunch = {
  eyebrow: 'New Launch',
  intro:
    'Revolutionary hair care range specially designed for Arab curly, coily & wavy hair. Experience 48-hour hydration with natural ingredients like Hyaluronic Acid, Coconut & Avocado.',
  badges: [
    { label: 'No SLS, Silicones, Parabens' },
    { label: '48-Hour Hydration' },
    { label: 'Hair Types 2, 3, 4' },
  ] as readonly Badge[],
  primaryCta: 'Explore Products',
  secondaryCta: 'Learn Curly Girl Method',
} as const

/* --------------------------------------------------------------- Benefit cards --- */

export interface BenefitCard {
  readonly title: string
  readonly body: string
  readonly cta: string
  readonly image: AssetName
  /** Which side the artwork sits on at desktop; the pair alternates in the design. */
  readonly imageSide: 'left' | 'right'
}

export const benefitCards: readonly BenefitCard[] = [
  {
    title: 'Lorem Ipsum',
    body: HYALURONIC_PARAGRAPH,
    cta: 'Learn More',
    image: 'bottle-conditioner-card',
    imageSide: 'right',
  },
  {
    title: 'Lorem Ipsum',
    body: HYALURONIC_PARAGRAPH,
    cta: 'Learn More',
    image: 'comb',
    imageSide: 'left',
  },
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
  trustBadges: ['No SLS', 'No Silicones', 'No Parabens', 'Cruelty Free', 'Natural Extracts'],
} as const

/* ------------------------------------------------------------------ Testimonials --- */

export interface Testimonial {
  readonly quote: string
  readonly name: string
  readonly location: string
  readonly rating: number
  readonly avatar: AssetName
}

/** The design shows the same testimonial twice; reproduced as authored. */
const AISHA: Testimonial = {
  quote:
    '"I\'ve struggled with frizz my whole life. Hydra Curls is the first range that actually tamed my hair for more than a day! The 48-hour claim is real."',
  name: 'Aisha K',
  location: 'Dubai, UAE',
  rating: 5,
  avatar: 'avatar-aisha',
}

export const testimonials = {
  eyebrow: 'Real Women, Real Results',
  heading: [
    [{ text: 'Hear from Our ' }, { text: 'Community', accent: true }],
  ] as readonly HeadingLine[],
  items: [AISHA, AISHA] as readonly Testimonial[],
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
    { ...RESOURCE, image: 'learn-1', imageSide: 'left' },
    { ...RESOURCE, image: 'learn-2', imageSide: 'right' },
    { ...RESOURCE, image: 'learn-3', imageSide: 'left' },
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
