import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * The header every admin sub-page shares.
 *
 * The back link is the point. `/admin/products` and `/admin/users` are reached from cards on the
 * overview, and once you are on one the only way back is the nav item you are already standing on
 * — which does nothing visible, because "Admin" is highlighted either way. A real link out is one
 * line and removes a small dead end.
 *
 * It is a `<Link>` rather than `navigate(-1)`: history-based back guesses at where you came from
 * and gets it wrong the moment someone opens the page from a bookmark or a new tab. This always
 * goes to the overview, which is what the label promises.
 */
export function AdminPageHeader({
  title,
  children,
}: {
  title: string;
  /** Right-hand controls — a search box, a "New product" button. */
  children?: ReactNode;
}) {
  return (
    <header className="mb-5">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1.5 rounded-sm text-xs text-ink-muted transition-colors duration-(--dur-fast) hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to Admin
      </Link>

      <div className="mt-2.5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Administration</p>
          <h1 className="mt-1 font-display text-2xl text-ink">{title}</h1>
        </div>
        {children ? <div className="flex items-end gap-2">{children}</div> : null}
      </div>
    </header>
  );
}
