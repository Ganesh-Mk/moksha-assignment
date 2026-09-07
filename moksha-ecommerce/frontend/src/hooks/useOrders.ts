import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { query, request } from "@/lib/api";
import type { AdminOrder, DashboardStats, Order, OrderStatus, Page } from "@/types/api";

export const orderKeys = {
  all: ["orders"] as const,
  mine: (filters: { status?: string; limit?: number; offset?: number }) =>
    [...orderKeys.all, "mine", filters] as const,
  detail: (id: number) => [...orderKeys.all, "detail", id] as const,
  admin: (filters: { status?: string; limit?: number; offset?: number }) =>
    [...orderKeys.all, "admin", filters] as const,
  stats: () => ["admin", "stats"] as const,
};

export function useMyOrders(filters: { status?: string; limit?: number; offset?: number } = {}) {
  return useQuery({
    queryKey: orderKeys.mine(filters),
    queryFn: () => request<Page<Order>>(`/orders${query({ ...filters })}`),
  });
}

/**
 * One order.
 *
 * `pollUntilSettled` drives the checkout success page. It refetches while the
 * order is still `pending_payment`, because the Stripe redirect proves nothing —
 * only the signed webhook moves an order to `paid` (DECISIONS D-010). Polling
 * stops the moment the status leaves that state, so it is bounded by the
 * webhook arriving rather than by a timer.
 */
export function useOrder(id: number | undefined, options: { pollUntilSettled?: boolean } = {}) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? 0),
    queryFn: () => request<Order>(`/orders/${id}`),
    enabled: id !== undefined,
    refetchInterval: (query) => {
      if (!options.pollUntilSettled) return false;
      const status = query.state.data?.status;
      return status === undefined || status === "pending_payment" ? 2000 : false;
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: { product_id: number; quantity: number }[]) =>
      request<Order>("/orders", { method: "POST", body: { items } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      // Stock has moved, so the catalogue is stale too.
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request<Order>(`/orders/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: (orderId: number) =>
      request<{ checkout_url: string; order: Order }>("/payments/create-checkout-session", {
        method: "POST",
        body: { order_id: orderId },
      }),
  });
}

// --- Admin -----------------------------------------------------------------

export function useAdminOrders(filters: { status?: string; limit?: number; offset?: number } = {}) {
  return useQuery({
    queryKey: orderKeys.admin(filters),
    queryFn: () => request<Page<AdminOrder>>(`/admin/orders${query({ ...filters })}`),
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) =>
      request<AdminOrder>(`/admin/orders/${id}/status`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      void queryClient.invalidateQueries({ queryKey: orderKeys.stats() });
      // Cancelling releases stock, so the catalogue changed.
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: orderKeys.stats(),
    queryFn: () => request<DashboardStats>("/admin/stats"),
    staleTime: 15_000,
  });
}
