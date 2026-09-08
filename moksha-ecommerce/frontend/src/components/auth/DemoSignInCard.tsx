import { KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ApiError } from "@/lib/api";

/**
 * The password-only sign-in, for reviewing the app.
 *
 * One field, no email, no role picker. The password does not identify an
 * account — it unlocks one fixed seeded admin. An email box would imply a user
 * directory this door does not have, and a role picker is unnecessary because
 * the admin account can do everything a customer can: browse, add to cart,
 * check out, and see its own orders. Anyone who wants a genuine customer
 * session signs in with Google, which is the real door.
 *
 * The copy is short on purpose. The full argument for why an OAuth app has a
 * password box lives in the README and in D-016; a reviewer standing at the
 * login screen needs one line and a field.
 */
export function DemoSignInCard({ onSignIn }: { onSignIn: (password: string) => Promise<unknown> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSignIn(password);
    } catch (cause) {
      // 404 is not "wrong password" — it is the endpoint not existing, because
      // this deployment has no DEMO_LOGIN_PASSWORD set. Reporting that as a bad
      // password sends someone hunting for one that was never going to work.
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
      <CardBody className="flex flex-col gap-3.5">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-soft-ink">
            <KeyRound className="size-3.5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-medium text-ink">For the Moksha testing team</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              Use the password to sign in — no Google account needed. This is an authentication
              shortcut for review, not an authorization bypass: it issues the same session token
              Google sign-in does, and every server-side check still applies.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <PasswordInput
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter the demo password"
            autoComplete="off"
            required
            {...(error ? { error } : {})}
          />

          <Button type="submit" loading={submitting} disabled={password.length === 0}>
            Sign in
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
