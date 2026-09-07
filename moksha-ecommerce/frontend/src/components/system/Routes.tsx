import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/hooks/authContext";

/**
 * Route guards.
 *
 * **These are navigation, not security.** They stop a signed-out visitor
 * landing on a page that will only show them errors, and they keep the admin
 * screens out of the way of customers. Every one of the endpoints behind them
 * is independently guarded on the server, and `tests/test_authz.py` proves it —
 * deleting this file would make the app unpleasant, not insecure.
 *
 * The distinction matters enough that the README states it too.
 */

function Waiting() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status">
      <Loader2
        className="size-5 animate-[spin_var(--dur-slow)_linear_infinite] text-ink-subtle"
        aria-hidden
      />
      <span className="sr-only">Checking your session…</span>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // "Still checking" is not "signed out". Redirecting during the initial
  // /auth/me would bounce a signed-in user to the login page on every refresh.
  if (isLoading) return <Waiting />;

  // `state.from` so sign-in returns the user to where they were heading —
  // being sent to the home page after logging in is a small, constant annoyance.
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <Waiting />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  // A signed-in customer is sent to the shop rather than the login page: they
  // are authenticated, just not authorised, and asking them to sign in again
  // would imply the wrong fix.
  if (!isAdmin) return <Navigate to="/products" replace />;

  return <>{children}</>;
}
