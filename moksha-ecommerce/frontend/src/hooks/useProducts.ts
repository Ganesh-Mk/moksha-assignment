import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { query, request } from "@/lib/api";
import type { Page, Product } from "@/types/api";

/**
 * Query keys as a factory rather than scattered string arrays.
 *
 * The point is invalidation: `queryKey: productKeys.all` invalidates every
 * product query at once, including every filter combination, because they all
 * share that prefix. Hand-written keys drift, and a key that drifts is a cache
 * entry that never invalidates — which shows up as an admin editing a price and
 * not seeing it change.
 */
export const productKeys = {
  all: ["products"] as const,
  list: (filters: ProductFilters) => [...productKeys.all, "list", filters] as const,
  detail: (slug: string) => [...productKeys.all, "detail", slug] as const,
  categories: () => [...productKeys.all, "categories"] as const,
  admin: (filters: AdminProductFilters) => [...productKeys.all, "admin", filters] as const,
};

export interface ProductFilters {
  search?: string;
  category?: string;
  in_stock_only?: boolean;
  limit?: number;
  offset?: number;
}

export interface AdminProductFilters {
  search?: string;
  limit?: number;
  offset?: number;
}

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () => request<Page<Product>>(`/products${query({ ...filters })}`),
    // The catalogue changes rarely. 30s of staleness avoids a refetch every
    // time someone navigates back from a product page, and stock is re-checked
    // authoritatively at checkout anyway.
    staleTime: 30_000,
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: productKeys.detail(slug),
    queryFn: () => request<Product>(`/products/${slug}`),
    staleTime: 30_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: productKeys.categories(),
    queryFn: () => request<string[]>("/products/categories"),
    staleTime: 5 * 60_000,
  });
}

// --- Admin -----------------------------------------------------------------

export function useAdminProducts(filters: AdminProductFilters) {
  return useQuery({
    queryKey: productKeys.admin(filters),
    queryFn: () => request<Page<Product>>(`/admin/products${query({ ...filters })}`),
  });
}

export interface ProductInput {
  name: string;
  slug: string;
  description: string;
  price_cents: number;
  category: string;
  stock: number;
  image_url: string | null;
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductInput) =>
      request<Product>("/admin/products", { method: "POST", body: input }),
    // Invalidate the whole product namespace: a new product affects the public
    // listing, the admin listing, and the category list.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: Partial<ProductInput> }) =>
      request<Product>(`/admin/products/${id}`, { method: "PATCH", body: changes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
}

export function useDeactivateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request<Product>(`/admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
}
