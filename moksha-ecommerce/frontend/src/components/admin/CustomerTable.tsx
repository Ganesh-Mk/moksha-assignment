import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { UserSummary } from "@/types/api";

/**
 * Who has an account, and what they have bought.
 *
 * The spend column counts paid and fulfilled orders only — the same definition
 * the revenue tile above uses. Two figures on one screen that disagree about
 * what a sale is are worse than one figure, and "why does the customer total
 * not add up to revenue?" is a question nobody should have to ask.
 *
 * It is a real `<table>`: this is tabular data, screen readers announce the
 * column a cell belongs to, and a grid of divs throws that away for nothing.
 */
export function CustomerTable({ users }: { users: UserSummary[] | undefined }) {
  if (users === undefined) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return <p className="p-4 text-xs text-ink-subtle">Nobody has signed up yet.</p>;
  }

  return (
    // Narrow screens scroll the table rather than squeezing five columns into
    // 320px. The page itself must never scroll sideways.
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <Th className="text-left">Customer</Th>
            <Th className="text-right">Orders</Th>
            <Th className="text-right">Paid</Th>
            <Th className="text-right">Spent</Th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              className="border-b border-line last:border-0 transition-colors duration-[--dur-fast] hover:bg-surface-hover"
            >
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-sunken text-2xs font-semibold text-ink-muted">
                    {user.picture_url ? (
                      <img
                        src={user.picture_url}
                        alt=""
                        width={32}
                        height={32}
                        className="size-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      (user.name.trim()[0] ?? "?").toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-ink">{user.name}</span>
                      {user.role === "admin" ? <Badge tone="accent">Admin</Badge> : null}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">{user.email}</span>
                  </span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">
                {user.order_count}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">
                {user.paid_order_count}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums font-medium text-ink">
                {user.total_spent_cents > 0 ? (
                  formatMoney(user.total_spent_cents)
                ) : (
                  <span className="text-ink-subtle">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("label-caps px-3 pb-2 pt-1", className)}>{children}</th>;
}
