import { Menu } from 'lucide-react'

import { Container } from '@/components/layout/Container'
import { Picture } from '@/components/primitives/Picture'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { navLinks } from '@/content/navigation'
import { site } from '@/content/site'
import { cn } from '@/lib/utils'

/** The first link is the current page; Figma renders it at full white and the rest at 55%. */
const linkClass = (isCurrent: boolean) =>
  cn(
    'flex min-h-11 items-center text-body transition-colors hover:text-white',
    isCurrent ? 'text-white' : 'text-white/55',
  )

/**
 * Top bar: 1920x100 on #040C1E with a 1px white/35 rule beneath, the logo inset at the 120px
 * grid margin, and the links optically centred on the page axis (their bounding box runs
 * 627–1294, whose midpoint is 960 — the exact centre of the frame).
 *
 * Below `lg` the link row collapses into a Sheet. The design provides no mobile frame, so this
 * is an invented breakpoint behaviour: four 20px links plus a logo cannot coexist on a 320px
 * bar without either wrapping or shrinking below a usable tap target.
 */
export function Navbar() {
  return (
    <header className="bg-ink relative z-30 w-full border-b border-white/35">
      <Container className="flex h-[4.375rem] items-center justify-between md:h-25">
        <a href="#top" className="flex items-center" aria-label={`${site.brand} ${site.product}`}>
          <Picture
            asset="logo-lockup"
            alt=""
            className="block w-[7.5rem] md:w-42"
            sizes="(min-width: 768px) 168px, 120px"
            priority
          />
        </a>

        {/* Absolutely centred rather than flex-centred: the logo and the menu button have
            different widths, so a plain `justify-between` would push the links off-axis. */}
        <nav aria-label="Main" className="absolute left-1/2 hidden -translate-x-1/2 lg:block">
          <ul className="flex items-center gap-16">
            {navLinks.map((link, index) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className={linkClass(index === 0)}
                  aria-current={index === 0 ? 'page' : undefined}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Sheet>
          <SheetTrigger
            className="flex size-11 items-center justify-center text-white lg:hidden"
            aria-label="Open menu"
          >
            <Menu aria-hidden="true" className="size-6" />
          </SheetTrigger>
          <SheetContent side="right" className="bg-ink w-72 border-l-white/20 text-white">
            <SheetTitle className="text-body px-6 pt-6 text-white/55">Menu</SheetTitle>
            <nav aria-label="Mobile">
              <ul className="flex flex-col gap-2 px-6 py-4">
                {navLinks.map((link, index) => (
                  <li key={link.label}>
                    <a href={link.href} className={linkClass(index === 0)}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </SheetContent>
        </Sheet>
      </Container>
    </header>
  )
}
