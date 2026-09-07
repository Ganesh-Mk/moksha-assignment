import { Loader2 } from "lucide-react";
import { Suspense, lazy, useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";

import { CartSheet } from "@/components/cart/CartSheet";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { Container } from "@/components/layout/Container";
import { Header } from "@/components/layout/Header";
import { RequireAdmin, RequireAuth } from "@/components/system/Routes";
import { Button } from "@/components/ui/Button";
import { LoginPage } from "@/pages/LoginPage";
import { ProductDetailPage } from "@/pages/ProductDetailPage";
import { ProductsPage } from "@/pages/ProductsPage";

/**
 * Routes, and the shell every page sits in.
 *
 * The admin section is lazily loaded. It is three screens most visitors will
 * never open, and shipping them in the initial bundle makes the catalogue —
 * the page a first-time visitor actually lands on — slower for no benefit.
 */
const AdminDashboardPage = lazy(() =>
  import("@/pages/admin/DashboardPage").then((m) => ({ default: m.AdminDashboardPage })),
);
const AdminProductsPage = lazy(() =>
  import("@/pages/admin/ProductsAdminPage").then((m) => ({ default: m.AdminProductsPage })),
);
const AdminOrdersPage = lazy(() =>
  import("@/pages/admin/OrdersAdminPage").then((m) => ({ default: m.AdminOrdersPage })),
);

const OrdersPage = lazy(() =>
  import("@/pages/OrdersPage").then((m) => ({ default: m.OrdersPage })),
);
const OrderDetailPage = lazy(() =>
  import("@/pages/OrderDetailPage").then((m) => ({ default: m.OrderDetailPage })),
);
const CheckoutSuccessPage = lazy(() =>
  import("@/pages/CheckoutResultPage").then((m) => ({ default: m.CheckoutSuccessPage })),
);
const CheckoutCancelledPage = lazy(() =>
  import("@/pages/CheckoutResultPage").then((m) => ({ default: m.CheckoutCancelledPage })),
);
// Lazy for the same reason as the admin screens: it is a wall of prose almost
// nobody opens, and Google's consent screen links to it directly rather than
// visitors reaching it from the catalogue.
const PrivacyPage = lazy(() =>
  import("@/pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status">
      <Loader2
        className="size-5 animate-[spin_var(--dur-slow)_linear_infinite] text-ink-subtle"
        aria-hidden
      />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function App() {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* First tab stop on every page. Without it, a keyboard user walks the
          whole header before reaching the content, on every navigation. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-accent-ink"
      >
        Skip to content
      </a>

      <Header onOpenCart={() => setCartOpen(true)} />

      <main id="main" className="flex-1">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/products" replace />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:slug" element={<ProductDetailPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />

            <Route
              path="/orders"
              element={
                <RequireAuth>
                  <OrdersPage />
                </RequireAuth>
              }
            />
            <Route
              path="/orders/:id"
              element={
                <RequireAuth>
                  <OrderDetailPage />
                </RequireAuth>
              }
            />

            <Route
              path="/checkout/success"
              element={
                <RequireAuth>
                  <CheckoutSuccessPage />
                </RequireAuth>
              }
            />
            <Route path="/checkout/cancelled" element={<CheckoutCancelledPage />} />

            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminDashboardPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/products"
              element={
                <RequireAdmin>
                  <AdminProductsPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <RequireAdmin>
                  <AdminOrdersPage />
                </RequireAdmin>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>

      <Footer />

      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
      <ChatWidget />
    </div>
  );
}

function NotFound() {
  return (
    <Container narrow className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
      <div>
        <p className="label-caps">404</p>
        <h1 className="mt-1 font-display text-3xl text-ink">Nothing here</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          That page does not exist, or it moved.
        </p>
      </div>
      <Button asChild variant="secondary" size="sm">
        <Link to="/products">Back to the shop</Link>
      </Button>
    </Container>
  );
}

function Footer() {
  return (
    <footer className="mt-12 border-t border-line py-6">
      <Container className="flex flex-col gap-2 text-xs text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-display text-sm text-ink-muted">Moksha</span> — a technical
          assignment, not a real shop. Payments run in Stripe test mode.
        </p>
        <nav className="flex gap-4" aria-label="Footer">
          <Link to="/products" className="rounded-sm transition-colors hover:text-ink">
            Shop
          </Link>
          <Link to="/privacy" className="rounded-sm transition-colors hover:text-ink">
            Privacy
          </Link>
          <a
            href={`${import.meta.env["VITE_API_URL"] ?? ""}/../docs`}
            className="rounded-sm transition-colors hover:text-ink"
            target="_blank"
            rel="noreferrer"
          >
            API docs
          </a>
        </nav>
      </Container>
    </footer>
  );
}
