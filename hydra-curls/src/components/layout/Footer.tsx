import { ArrowRight } from 'lucide-react'

import { Container } from '@/components/layout/Container'
import { Picture } from '@/components/primitives/Picture'
import { Input } from '@/components/ui/input'
import { footer, footerColumns } from '@/content/navigation'
import { site } from '@/content/site'

/**
 * y14692–15249. Black band: brand blurb, three link columns, newsletter capture.
 *
 * The newsletter control is a real <form> with a labelled input rather than a decorative field.
 * The label is visually hidden because the design shows only a placeholder, but a placeholder
 * is not a label — it disappears the moment someone types, and screen readers may skip it.
 */
export function Footer() {
  return (
    <footer className="w-full bg-black py-14 md:py-20">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,30%)_1fr_1fr_1fr] lg:gap-10">
          <div>
            <Picture
              asset="wordmark"
              alt={`${site.brand} ${site.product}`}
              className="w-[9.8125rem]"
              sizes="157px"
            />
            <p className="text-body mt-8 max-w-[23.6875rem] leading-normal text-white/75">
              {footer.blurb}
            </p>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <h2 className="text-body text-white">{column.title}</h2>
              {column.blurb && (
                <p className="mt-3 max-w-[16.25rem] text-sm leading-normal text-white/75">
                  {column.blurb}
                </p>
              )}
              {column.links && (
                <ul className="mt-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="flex min-h-11 items-center text-sm text-white/75 transition-colors hover:text-white"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {column.title === 'Newsletter' && (
                <form
                  className="border-brand-cyan-dark/45 mt-6 flex max-w-[25.4375rem] overflow-hidden rounded-[0.625rem] border bg-white/7"
                  // No backend to submit to; the control is real and labelled, and the
                  // handler is left off rather than faked with a no-op that looks like it works.
                >
                  <label htmlFor="newsletter-email" className="sr-only">
                    Email address
                  </label>
                  <Input
                    id="newsletter-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder={footer.emailPlaceholder}
                    className="h-14 flex-1 rounded-none border-0 bg-transparent px-4 text-sm text-white placeholder:text-white/45 focus-visible:ring-0"
                  />
                  <button
                    type="submit"
                    className="bg-brand-cyan hover:bg-brand-cyan-deepest flex w-16 shrink-0 items-center justify-center text-white transition-colors"
                  >
                    <span className="sr-only">Subscribe</span>
                    <ArrowRight aria-hidden="true" className="size-7" />
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>

        <hr className="mt-14 border-white/15" />
        <p className="mt-8 text-center text-sm text-white/50">{footer.copyright}</p>
      </Container>
    </footer>
  )
}
