import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { Container } from "@/components/layout/Container";
import { Card, CardBody } from "@/components/ui/Card";
import { useAuth } from "@/hooks/authContext";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";
import { ApiError } from "@/lib/api";

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const { user, isLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);

  const destination = (location.state as LocationState | null)?.from?.pathname ?? "/products";

  const { buttonRef, status, error: googleError } = useGoogleSignIn({
    onCredential: async (idToken) => {
      setError(null);
      setExchanging(true);
      try {
        // The token goes straight to our backend, which verifies it against
        // Google's JWKS before trusting a single claim in it. Nothing in this
        // component reads the token's contents.
        await signIn(idToken);
        navigate(destination, { replace: true });
      } catch (cause) {
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Sign-in failed. Please try again.",
        );
      } finally {
        setExchanging(false);
      }
    },
  });

  // Already signed in — do not show a login form to someone who is logged in.
  if (!isLoading && user) return <Navigate to={destination} replace />;

  return (
    <Container narrow className="flex min-h-[70vh] items-center justify-center py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="label-caps">Moksha Haircare</p>
          <h1 className="mt-1.5 font-display text-3xl text-ink">Sign in</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            To place an order and follow it through to delivery.
          </p>
        </div>

        <Card>
          <CardBody className="flex flex-col items-center gap-4 py-7">
            {status === "unavailable" ? (
              <div className="flex items-start gap-2 rounded-md bg-danger-soft p-3 text-left">
                <AlertTriangle className="mt-px size-4 shrink-0 text-danger" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-danger-soft-ink">
                    Google Sign-In is unavailable
                  </p>
                  <p className="mt-0.5 text-xs text-danger-soft-ink/80">{googleError}</p>
                </div>
              </div>
            ) : (
              <>
                {/* Google renders its own button into this element. It is not
                    restyled: Google's branding guidelines require their button,
                    and a lookalike is both a policy problem and a phishing
                    pattern users are right to distrust. */}
                <div ref={buttonRef} className="min-h-10" />
                {status === "loading" ? (
                  <Loader2
                    className="size-4 animate-[spin_var(--dur-slow)_linear_infinite] text-ink-subtle"
                    aria-hidden
                  />
                ) : null}
                {exchanging ? (
                  <p className="text-xs text-ink-muted" role="status">
                    Verifying with Moksha…
                  </p>
                ) : null}
              </>
            )}

            {error ? (
              <p className="text-center text-xs text-danger" role="alert">
                {error}
              </p>
            ) : null}
          </CardBody>
        </Card>

        <div className="mt-5 flex items-start gap-2 text-xs text-ink-subtle">
          <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
          <p className="leading-snug">
            Your Google ID token is verified against Google's public keys on our server before any
            session is created. We store your name, email and avatar — nothing else.
          </p>
        </div>
      </div>
    </Container>
  );
}
