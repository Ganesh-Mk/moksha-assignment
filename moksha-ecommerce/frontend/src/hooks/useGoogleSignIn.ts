import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Google Identity Services.
 *
 * The script is loaded on demand rather than in `index.html`: it is ~50 KB of
 * third-party JavaScript that only the sign-in page needs, and every other page
 * — including the catalogue, which is what a first-time visitor actually
 * lands on — should not pay for it.
 *
 * The flow is the ID-token one, not the redirect one. Google returns a signed
 * JWT to the page, which is POSTed once to `/auth/google`; the backend verifies
 * it against Google's JWKS and issues our own tokens. That means the app needs
 * only an **authorized JavaScript origin** in the Google Cloud console — no
 * redirect URI, no client secret in the browser, and no code-exchange round
 * trip.
 */

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const CLIENT_ID = import.meta.env["VITE_GOOGLE_CLIENT_ID"] as string | undefined;

interface CredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
  disableAutoSelect: () => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  // Memoised: React 18+ mounts effects twice in development StrictMode, and
  // without this the script tag is appended twice and Google's library
  // initialises against a stale element.
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null; // allow a retry after a transient network failure
      reject(new Error("Could not load Google Sign-In."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface UseGoogleSignInOptions {
  onCredential: (idToken: string) => void | Promise<void>;
}

export function useGoogleSignIn({ onCredential }: UseGoogleSignInOptions) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptState, setScriptState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [error, setError] = useState<string | null>(null);

  // The callback is held in a ref so re-rendering the page does not re-run the
  // effect and re-render Google's button, which would visibly flicker. Written
  // in an effect rather than during render: a ref write during render is not
  // safe under concurrent rendering, where a render can be discarded.
  const callbackRef = useRef(onCredential);
  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  // Derived, not stored. Whether the client id exists is knowable at render
  // time; routing it through an effect just renders one wrong frame first.
  const configured = Boolean(CLIENT_ID);
  const status = configured ? scriptState : "unavailable";
  const message = configured
    ? error
    : "VITE_GOOGLE_CLIENT_ID is not set. Copy .env.example to .env and add the client id.";

  useEffect(() => {
    if (!CLIENT_ID) return;

    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => {
            if (response.credential) void callbackRef.current(response.credential);
          },
          // No One Tap auto-select: silently signing someone in on page load is
          // a surprise, and it makes signing out feel broken because the next
          // page load signs them straight back in.
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: 320,
        });

        setScriptState("ready");
      })
      .catch((cause: Error) => {
        if (cancelled) return;
        setScriptState("unavailable");
        setError(cause.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const disableAutoSelect = useCallback(() => {
    window.google?.accounts.id.disableAutoSelect();
  }, []);

  return { buttonRef, status, error: message, disableAutoSelect };
}
