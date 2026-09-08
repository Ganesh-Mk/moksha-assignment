import { KeyRound, ShieldAlert } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api";
import type { UserRole } from "@/types/api";

const ROLES: { value: UserRole; label: string; blurb: string }[] = [
  {
    value: "admin",
    label: "Admin",
    blurb: "Order queue, status changes, product editing.",
  },
  {
    value: "customer",
    label: "Customer",
    blurb: "Shop, checkout, order history, AI assistant.",
  },
];

/**
 * The password-only sign-in, for reviewing the app.
 *
 * There is no email field and that is the design, not a shortcut: the password does not identify
 * an account, it *unlocks* two fixed seeded ones. An email box would imply a user directory that
 * this door does not have, and would be one more thing to get wrong.
 *
 * The copy is blunt about what this is, because a reviewer's first question on seeing a password
 * box in an OAuth app should be "is the authorization real, then?" — and the answer is yes. The
 * server issues the same JWT either way; `require_admin`, order ownership and the agent's identity
 * scoping never learn which door was used.
 */
export function DemoSignInCard({
  onSignIn,
}: {
  onSignIn: (password: string, role: UserRole) => Promise<unknown>;
}) {
  const [role, setRole] = useState<UserRole>("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSignIn(password, role);
    } catch (cause) {
      // 404 is not "wrong password" — it is the endpoint not existing, because this deployment
      // has no DEMO_LOGIN_PASSWORD set. Reporting that as a bad password would send someone
      // hunting for a password that was never going to work.
      setError(
        cause instanceof ApiError
          ? cause.status === 404
            ? "Demo sign-in is switched off on this deployment."
            : cause.message
          : "Sign-in failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div>
            <h2 className="text-sm font-medium text-ink">Reviewer sign-in — not Google OAuth</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              The Google consent screen above is in <strong>Testing</strong> mode, so only
              allow-listed Google accounts can use it. This password door exists so the app can be
              reviewed without one. It is an <strong>authentication</strong> shortcut, not an
              authorization bypass — it issues the same session token as Google sign-in for a real
              account, and every server-side check still applies.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="label-caps text-ink-muted">Sign in as</legend>
            <div
              className="flex gap-1 rounded-md border border-line bg-surface-sunken p-1"
              role="radiogroup"
              aria-label="Demo account role"
            >
              {ROLES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={role === option.value}
                  onClick={() => setRole(option.value)}
                  className={cn(
                    "flex-1 rounded-sm px-3 py-1.5 text-xs font-medium",
                    "transition-[background-color,color,box-shadow] duration-[--dur-fast] ease-out",
                    role === option.value
                      ? "bg-surface text-ink shadow-raised"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-subtle">
              {ROLES.find((option) => option.value === role)?.blurb}
            </p>
          </fieldset>

          <Input
            label="Demo password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            adornment={<KeyRound className="size-3.5" />}
            autoComplete="off"
            required
            {...(error ? { error } : {})}
          />

          <Button type="submit" loading={submitting} disabled={password.length === 0}>
            Sign in as {role}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
