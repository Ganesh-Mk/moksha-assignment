/**
 * Types mirroring the backend's Pydantic schemas.
 *
 * Hand-written rather than generated from the OpenAPI document. That is a
 * deliberate trade for an application this size: generation would add a build
 * step and a checked-in artefact that goes stale between runs, and there are
 * about thirty fields in total. The honest cost is that a backend rename is
 * caught at runtime rather than at compile time — worth stating, and the reason
 * `api.ts` narrows every response rather than trusting it.
 */

export type UserRole = "customer" | "admin";

export interface User {
  id: number;
  email: string;
  name: string;
  picture_url: string | null;
  role: UserRole;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  /** Integer cents. Never divide this outside `formatMoney`. */
  price_cents: number;
  currency: string;
  image_url: string | null;
  category: string;
  stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "fulfilled"
  | "payment_failed"
  | "cancelled";

export interface OrderItem {
  id: number;
  product_id: number;
  /** Snapshotted at purchase time — not the product's current name. */
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
}

export interface Order {
  id: number;
  status: OrderStatus;
  subtotal_cents: number;
  total_cents: number;
  currency: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
  stripe_session_id: string | null;
  /**
   * The states this order may legally move to next, published by the server.
   * The admin UI reads this instead of keeping its own copy of the state
   * machine, which would drift.
   */
  allowed_transitions: OrderStatus[];
}

export interface AdminOrder extends Order {
  user: User;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface DashboardStats {
  total_revenue_cents: number;
  paid_order_count: number;
  total_order_count: number;
  customer_count: number;
  orders_by_status: { status: string; count: number }[];
  low_stock: { id: number; name: string; slug: string; stock: number }[];
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
  request_id: string | null;
}
