export interface NavLink {
  readonly label: string
  readonly href: string
}

/** Figma order, left to right. Hrefs are in-page anchors — this is a single-page design. */
export const navLinks: readonly NavLink[] = [
  { label: 'Home', href: '#top' },
  { label: 'Products', href: '#products' },
  { label: 'Hair Care Blog', href: '#learn' },
  { label: 'Curly Girl Method', href: '#learn' },
]

export interface FooterColumn {
  readonly title: string
  readonly blurb?: string
  readonly links?: readonly NavLink[]
}

export const footerColumns: readonly FooterColumn[] = [
  {
    title: 'Hair care',
    links: [
      { label: 'Curly Girl Method', href: '#learn' },
      { label: 'Hair Type Guide', href: '#hair-types' },
      { label: 'Styling Tips', href: '#learn' },
      { label: 'Ingredient Benefits', href: '#ingredients' },
    ],
  },
  {
    title: 'Connect',
    blurb: 'Follow us for daily hair care tips and inspiration for your curly hair journey.',
  },
  {
    title: 'Newsletter',
    blurb: 'Get expert tips and exclusive offers delivered to your inbox.',
  },
]

export const footer = {
  blurb:
    'Advanced hair care specially designed for Arab curly, coily & wavy hair types 2, 3, and 4.',
  emailPlaceholder: 'Your email',
  copyright: '© 2026 Parachute Advanced Hydra Curls. All rights reserved.',
} as const
