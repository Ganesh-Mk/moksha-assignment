import { Menu } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Container } from '@/components/layout/Container'
import { Picture } from '@/components/primitives/Picture'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { navLinks } from '@/content/navigation'
import { site } from '@/content/site'
import { cn } from '@/lib/utils'

/** The first link is the current page; Figma renders it at full white and the rest at 55%. */
const linkClass = (isCurrent: boolean) =>
  cn(
    'relative flex min-h-11 items-center text-body transition-colors hover:text-white',
    // The underline is a scaled pseudo-element rather than a width or border change, so it
    // animates on the compositor and cannot reflow the row.
    'after:bg-brand-cyan after:absolute after:inset-x-0 after:bottom-2 after:h-px after:origin-left',
    'after:scale-x-0 after:transition-transform after:duration-300 hover:after:scale-x-100',
    isCurrent ? 'text-white after:scale-x-100' : 'text-white/55',
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
  // `hidden` drives hide-on-scroll-down / show-on-scroll-up; `atTop` keeps the bar transparent
  // over the hero. Both are state rather than direct style writes so React owns the DOM it
  // hydrated.
  const [hidden, setHidden] = useState(false)
  const [atTop, setAtTop] = useState(true)
  const lastY = useRef(0)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      // Reading scrollY inside rAF keeps the layout read off the scroll handler itself, so a
      // fast scroll cannot turn this into a stream of forced synchronous layouts.
      requestAnimationFrame(() => {
        const y = window.scrollY
        setAtTop(y < 40)
        // The 8px deadband stops trackpad jitter from flickering the bar; below 120px the bar
        // always shows, so it is never hidden while the reader is still at the top.
        if (!reduced && Math.abs(y - lastY.current) > 8) {
          setHidden(y > lastY.current && y > 120)
          lastY.current = y
        }
        ticking = false
      })
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    // The outer element is fixed but never transforms, so the reading-progress bar it carries
    // stays on screen when the bar itself slides away. Nesting the two was the bug: the
    // progress bar rode up with the header and vanished exactly when it was most useful.
    <header className="fixed top-0 z-30 w-full">
      <div
        className={cn(
          'w-full transition-[transform,background-color,border-color,backdrop-filter] duration-300 will-change-transform',
          // Transparent over the hero so the two read as one surface — the hero's own artwork
          // becomes the bar's background instead of a navy strip butting against purple. The
          // solid state returns as soon as the reader leaves the top.
          atTop
            ? 'border-b border-transparent bg-transparent'
            : 'bg-ink/90 border-b border-white/20 backdrop-blur-md',
          hidden ? '-translate-y-full' : 'translate-y-0',
        )}
      >
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
      </div>

      {/* Reading progress — a sibling of the sliding bar, not a child, so it stays put while
          the bar hides. Driven by a scroll-linked CSS animation, so it costs no JavaScript and
          runs on the compositor; browsers without `animation-timeline` just leave it at zero
          width, which is why it is decorative. */}
      <div
        aria-hidden="true"
        className={cn(
          'bg-brand-cyan/25 absolute inset-x-0 top-0 h-[0.1875rem]',
          'transition-transform duration-300',
          // Normally it rides on the bar's lower edge. When the bar slides away it travels up
          // with it and parks against the top of the viewport, rather than being left hanging
          // in the space the bar used to occupy.
          hidden ? 'translate-y-0' : 'translate-y-[4.375rem] md:translate-y-25',
        )}
      >
        <div className="bg-brand-cyan scroll-progress h-full w-full" />
      </div>
    </header>
  )
}
