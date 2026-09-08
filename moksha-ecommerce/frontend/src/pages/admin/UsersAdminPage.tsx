import { RotateCcw, Search, UserX, Users } from "lucide-react";
import { useState } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/toastContext";
import { useAuth } from "@/hooks/authContext";
import { useAdminUsers, useSetUserActive } from "@/hooks/useOrders";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import type { UserSummary } from "@/types/api";

/**
 * Account management — the same shape as the catalogue screen next door, deliberately.
 *
 * **"Delete" is a disable, and the UI says so.** A hard delete would either orphan the customer's
 * orders or cascade them away, and an order has to survive as a financial record whatever happens
 * to the account. So the row dims, the badge reads *Disabled*, and the same button restores it.
 * A destructive action you cannot undo is one people are right to hesitate over; this one they
 * can undo from the row they broke.
 *
 * The search is client-side, unlike the catalogue's. That is not laziness in both directions:
 * products can run to thousands and paginate server-side, whereas this screen loads at most a
 * couple of hundred accounts and filtering them in the browser costs one keystroke's work instead
 * of one request's. If the user table ever outgrows that, the endpoint already paginates.
 */
export function AdminUsersPage() {
  const [search, setSearch] = useState("");
  // 100 is the endpoint's ceiling, shared by every paginated route here. Beyond that the
  // answer is the pagination the endpoint already has, not a bigger page.
  const { data } = useAdminUsers(100);
  const setActive = useSetUserActive();
  const { user: me } = useAuth();
  const toast = useToast();

  const needle = search.trim().toLowerCase();
  const users = data?.items.filter(
    (user) =>
      !needle ||
      user.name.toLowerCase().includes(needle) ||
      user.email.toLowerCase().includes(needle),
  );

  async function toggle(user: UserSummary): Promise<void> {
    const restoring = !user.is_active;
    try {
      await setActive.mutateAsync({ id: user.id, isActive: restoring });
      if (restoring) {
        toast.success("Account restored", `${user.name} can sign in again.`);
      } else {
        toast.success("Account disabled", `${user.name} can no longer sign in. Their orders stay.`);
      }
    } catch (error) {
      toast.error(
        restoring ? "Could not restore" : "Could not disable",
        error instanceof ApiError ? error.message : "Try again.",
      );
    }
  }

  return (
    <Container className="py-8">
      <AdminPageHeader title="Customers">
        <Input
          label="Search"
          hideLabel
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          adornment={<Search className="size-3.5" />}
          className="w-56"
        />
      </AdminPageHeader>

      {users === undefined ? (
        <Skeleton className="h-64 w-full" />
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "No accounts match" : "Nobody has signed up yet"}
          description={search ? "Try a different search." : "Accounts appear here on first sign-in."}
        />
      ) : (
        <Card className="overflow-hidden">
          {/* The wrapper scrolls, not the page. A table that widens the body is
              how a "responsive" layout ends up with horizontal page scroll. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="border-b border-line bg-surface-sunken">
                <tr className="[&>th]:label-caps [&>th]:px-4 [&>th]:py-2">
                  <th scope="col">Customer</th>
                  <th scope="col">Joined</th>
                  <th scope="col" className="text-right">Orders</th>
                  <th scope="col" className="text-right">Paid</th>
                  <th scope="col" className="text-right">Spent</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((user) => {
                  const isMe = user.id === me?.id;
                  return (
                    <tr
                      key={user.id}
                      className={cn(
                        "transition-colors duration-(--dur-fast) hover:bg-surface-hover",
                        !user.is_active && "opacity-60",
                      )}
                    >
                      <td className="px-4 py-2.5">
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
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-medium text-ink">
                              <span className="truncate">{user.name}</span>
                              {user.role === "admin" ? <Badge tone="accent">Admin</Badge> : null}
                              {isMe ? <Badge tone="neutral">You</Badge> : null}
                            </p>
                            <p className="truncate text-2xs text-ink-subtle">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-ink-muted">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="tnum px-4 py-2.5 text-right text-ink-muted">
                        {user.order_count}
                      </td>
                      <td className="tnum px-4 py-2.5 text-right text-ink-muted">
                        {user.paid_order_count}
                      </td>
                      <td className="tnum px-4 py-2.5 text-right font-medium text-ink">
                        {user.total_spent_cents > 0 ? (
                          formatMoney(user.total_spent_cents)
                        ) : (
                          <span className="text-ink-subtle">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {user.is_active ? (
                          <Badge tone="accent">Active</Badge>
                        ) : (
                          <Badge tone="neutral">Disabled</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end">
                          {user.is_active ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 hover:text-danger"
                              // Disabled rather than hidden: the reason it is
                              // refused is worth showing, and the server refuses
                              // it too — this is the courtesy, not the control.
                              disabled={isMe}
                              title={
                                isMe ? "You cannot disable your own account" : "Disable account"
                              }
                              onClick={() => void toggle(user)}
                            >
                              <UserX className="size-3.5" aria-hidden />
                              <span className="sr-only">Disable {user.name}</span>
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 hover:text-accent"
                              title="Restore account"
                              onClick={() => void toggle(user)}
                            >
                              <RotateCcw className="size-3.5" aria-hidden />
                              <span className="sr-only">Restore {user.name}</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Container>
  );
}
