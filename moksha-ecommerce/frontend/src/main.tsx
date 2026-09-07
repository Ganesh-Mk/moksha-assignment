import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "@/App";
import { ErrorBoundary } from "@/components/system/ErrorBoundary";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api";
import "@/styles/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Refetching on every window focus is Query's default and it is wrong for
      // a shop: alt-tabbing away and back should not re-request the catalogue.
      refetchOnWindowFocus: false,
      staleTime: 10_000,
      retry: (failureCount, error) => {
        // Retrying a 4xx is pointless — the request will fail the same way. A
        // 401 in particular has already been through one silent token refresh
        // inside `request`, so a retry here would just repeat a dead session.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      // Never retry a mutation automatically. `POST /orders` reserves stock;
      // retrying a request that may have already succeeded is how a customer
      // ends up with two orders.
      retry: false,
    },
  },
});

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {/* Auth sits inside Query because signing in and out invalidates the
              cache, and inside Router because the guards redirect. */}
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
