import { createContext, use } from "react";

import type { User } from "@/types/api";

/**
 * The auth context and its hook, split out from the provider component.
 *
 * Not an arbitrary split: a module that exports both a component and a
 * non-component breaks React Fast Refresh, so every edit to `AuthProvider`
 * would full-reload the page and lose application state instead of hot-
 * swapping. Keeping the provider alone in its own file fixes that.
 */
export interface AuthState {
  user: User | null;
  /** True until the initial `/auth/me` settles — distinct from "signed out". */
  isLoading: boolean;
  isAdmin: boolean;
  signIn: (googleIdToken: string) => Promise<User>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const context = use(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
