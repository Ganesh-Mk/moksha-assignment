import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { AuthContext, type AuthState } from "@/hooks/authContext";
import { ApiError, request, tokenStore } from "@/lib/api";
import type { TokenResponse, User } from "@/types/api";

/**
 * Session state provider.
 *
 * Kept in a context rather than in the Query cache because it is not really
 * server data — it is the identity every other request is made *as*, and
 * treating it as a cache entry leads to the awkward case of a query refetching
 * with a token that has just been thrown away.
 *
 * On load the session is restored by calling `/auth/me` with the stored token.
 * That is a real round-trip on every page load, and it is deliberate: decoding
 * the JWT client-side would be faster but would trust a token the server might
 * have already stopped honouring, and would show a signed-in shell to someone
 * whose account was disabled a minute ago.
 */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    async function restore(): Promise<void> {
      if (!tokenStore.access()) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await request<User>("/auth/me");
        if (!cancelled) setUser(me);
      } catch (error) {
        // A 401 here means the stored token is dead and the refresh (attempted
        // inside `request`) also failed. Clearing is right. Any other error is
        // the API being unreachable — keep the token, because throwing away a
        // valid session over a cold start would be its own bug.
        if (error instanceof ApiError && error.isAuthError) tokenStore.clear();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  // Adopt a token pair as the current session. Shared by both sign-in doors,
  // because everything after the exchange is identical — which is the client
  // half of the point made in `auth_service.sign_in_with_demo_password`: the
  // demo password is a different way to *authenticate*, not a different kind
  // of session.
  const adopt = useCallback(
    async (response: TokenResponse): Promise<User> => {
      tokenStore.set(response.access_token, response.refresh_token);
      setUser(response.user);
      // Anything cached was fetched as "nobody". Clear it so the new session
      // does not briefly render the previous one's (or no one's) data.
      await queryClient.invalidateQueries();
      return response.user;
    },
    [queryClient],
  );

  const signIn = useCallback(
    (googleIdToken: string): Promise<User> =>
      request<TokenResponse>("/auth/google", {
        method: "POST",
        body: { id_token: googleIdToken },
        anonymous: true,
      }).then(adopt),
    [adopt],
  );

  const signInWithDemoPassword = useCallback(
    // No role in the body: the endpoint defaults to admin, and the admin
    // account can already do everything a customer can.
    (password: string): Promise<User> =>
      request<TokenResponse>("/auth/demo", {
        method: "POST",
        body: { password },
        anonymous: true,
      }).then(adopt),
    [adopt],
  );

  const signOut = useCallback(() => {
    // Fire-and-forget: the endpoint exists so the sign-out is recorded, but the
    // client must not stay signed in because a network call failed.
    void request("/auth/logout", { method: "POST" }).catch(() => undefined);
    tokenStore.clear();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      isAdmin: user?.role === "admin",
      signIn,
      signInWithDemoPassword,
      signOut,
    }),
    [user, isLoading, signIn, signInWithDemoPassword, signOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
