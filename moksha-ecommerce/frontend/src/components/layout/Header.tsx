import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LayoutDashboard, LogOut, Menu, Package, ShoppingBag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/authContext";
import { cn } from "@/lib/cn";
import { registerCartTarget } from "@/lib/flyToCart";
import { selectItemCount, useCart } from "@/store/cart";

/**
 * The application header.
 *
 * A note the README repeats, because it is the difference between understanding
 * authorization and performing it: **the Admin link below is hidden from
 * customers as a courtesy, not as a control.** Every admin route is guarded by
 * `require_admin` on the server, and `tests/test_authz.py` proves a customer's
 * token receives 403 on all of them. Deleting this conditional would change
 * nothing about what a customer can actually do.
 */

export function Header({ onOpenCart }: { onOpenCart: () => void }) {
  const { user, isAdmin, signOut } = useAuth();
  const itemCount = useCart(selectItemCount);
  const [mobileOpen, setMobileOpen] = useState(false);
  const cartButton = useRef<HTMLButtonElement>(null);

  // The add-to-cart animation needs somewhere to fly *to*, and only the header
  // knows where that is. Registered rather than passed down, because otherwise
  // every component that can add to the cart would need a ref threaded through
  // it from here.
  useEffect(() => {
    registerCartTarget(cartButton.current);
    return () => registerCartTarget(null);
  }, []);

  const links = [
    { to: "/products", label: "Shop" },
    ...(user ? [{ to: "/orders", label: "Orders" }] : []),
    ...(isAdmin ? [{ to: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-line",
        // Translucent with a blur, so content scrolling underneath is hinted at
        // rather than hidden behind an opaque bar.
        "bg-[color-mix(in_srgb,var(--paper)_88%,transparent)] backdrop-blur-md",
      )}
    >
      <div className="mx-auto flex h-[var(--header-h)] max-w-[var(--container-page)] items-center gap-4 px-4 sm:px-6">
        <Link
          to="/products"
          className="flex shrink-0 items-baseline gap-1.5 rounded-sm"
          aria-label="Moksha — home"
        >
          <span className="font-display text-lg leading-none text-ink">Moksha</span>
          <span className="hidden text-2xs uppercase tracking-(--tracking-label) text-ink-subtle sm:inline">
            Haircare
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 sm:flex" aria-label="Main">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-2.5 py-1.5 text-sm transition-colors duration-(--dur-fast)",
                  isActive
                    ? "bg-surface-sunken font-medium text-ink"
                    : "text-ink-muted hover:bg-surface-hover hover:text-ink",
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            ref={cartButton}
            type="button"
            onClick={onOpenCart}
            className={cn(
              "relative flex h-9 items-center gap-2 rounded-md border border-line-strong px-2.5",
              "text-sm text-ink transition-colors duration-(--dur-fast) hover:bg-surface-hover",
            )}
          >
            <ShoppingBag className="size-4" aria-hidden />
            <span className="hidden sm:inline">Cart</span>
            {itemCount > 0 ? (
              <span
                className={cn(
                  "flex min-w-4 items-center justify-center rounded-full bg-accent px-1",
                  "text-2xs font-semibold tabular-nums text-accent-ink",
                  // Pops on change so adding to the cart is visible even when
                  // the sheet is closed.
                  "animate-[scale-in_var(--dur-base)_var(--ease-spring)]",
                )}
                key={itemCount}
              >
                {itemCount}
              </span>
            ) : null}
            <span className="sr-only">
              {itemCount === 0 ? "Cart is empty" : `${itemCount} items in cart`}
            </span>
          </button>

          {user ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex size-9 items-center justify-center overflow-hidden rounded-full",
                    "border border-line-strong bg-surface-sunken text-xs font-semibold text-ink-muted",
                    "transition-colors duration-(--dur-fast) hover:border-ink-subtle",
                  )}
                  aria-label={`Account menu for ${user.name}`}
                >
                  {user.picture_url ? (
                    <img
                      src={user.picture_url}
                      alt=""
                      width={36}
                      height={36}
                      className="size-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className={cn(
                    "z-50 min-w-52 rounded-lg border border-line bg-surface p-1 shadow-overlay",
                    "data-[state=open]:animate-[scale-in_var(--dur-fast)_var(--ease-out)]",
                  )}
                >
                  <div className="border-b border-line px-2 py-2">
                    <p className="truncate text-sm font-medium text-ink">{user.name}</p>
                    <p className="truncate text-xs text-ink-muted">{user.email}</p>
                    {isAdmin ? (
                      <p className="mt-1 text-2xs font-semibold uppercase tracking-(--tracking-label) text-accent">
                        Administrator
                      </p>
                    ) : null}
                  </div>

                  <MenuLink to="/orders" icon={Package}>
                    My orders
                  </MenuLink>
                  {isAdmin ? (
                    <MenuLink to="/admin" icon={LayoutDashboard}>
                      Admin dashboard
                    </MenuLink>
                  ) : null}

                  <DropdownMenu.Separator className="my-1 h-px bg-line" />

                  <DropdownMenu.Item
                    onSelect={signOut}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                      "text-ink-muted outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-ink",
                    )}
                  >
                    <LogOut className="size-3.5" aria-hidden />
                    Sign out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : (
            // Default size, i.e. h-9 — the same height as the cart button it
            // sits beside. A shorter one reads as a mistake, because it is.
            <Button asChild className="hidden sm:inline-flex">
              <Link to="/login">Sign in</Link>
            </Button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="rounded-md p-2 text-ink-muted transition-colors hover:bg-surface-hover sm:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            {mobileOpen ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
            <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t border-line bg-surface px-4 py-2 sm:hidden animate-[rise-in_var(--dur-fast)_var(--ease-out)]"
          // Closed by the click that navigates rather than by an effect
          // watching the route: reacting after the fact means one frame where
          // the menu covers the page it just moved to.
          onClick={() => setMobileOpen(false)}
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "block rounded-md px-2 py-2 text-sm",
                  isActive ? "bg-surface-sunken font-medium text-ink" : "text-ink-muted",
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
          {!user ? (
            <Link to="/login" className="block rounded-md px-2 py-2 text-sm font-medium text-accent">
              Sign in
            </Link>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}

function MenuLink({
  to,
  icon: Icon,
  children,
}: {
  to: string;
  icon: typeof Package;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        to={to}
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
          "text-ink-muted outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-ink",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {children}
      </Link>
    </DropdownMenu.Item>
  );
}
