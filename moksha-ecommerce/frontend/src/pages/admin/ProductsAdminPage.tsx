import { EyeOff, PackageSearch, Pencil, Plus, Search } from "lucide-react";
import { useState } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Container } from "@/components/layout/Container";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/toastContext";
import {
  useAdminProducts,
  useCreateProduct,
  useDeactivateProduct,
  useUpdateProduct,
  type ProductInput,
} from "@/hooks/useProducts";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/types/api";

/**
 * Catalogue management.
 *
 * Prices are entered in rupees and converted to integer cents at the boundary,
 * in one place (`toCents`). Everything downstream of that — state, request
 * body, database — is an integer, so the float never gets a chance to
 * accumulate error (DECISIONS D-004).
 */
export function AdminProductsPage() {
  const [search, setSearch] = useState("");
  const { data } = useAdminProducts({ ...(search ? { search } : {}), limit: 100 });
  const deactivate = useDeactivateProduct();
  const toast = useToast();

  async function handleDeactivate(product: Product) {
    try {
      await deactivate.mutateAsync(product.id);
      toast.success("Product withdrawn", `${product.name} is hidden from the catalogue.`);
    } catch (error) {
      toast.error("Could not withdraw", error instanceof ApiError ? error.message : "Try again.");
    }
  }

  return (
    <Container className="py-8">
      <AdminPageHeader title="Catalogue">
          <Input
            label="Search"
            hideLabel
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            adornment={<Search className="size-3.5" />}
            className="w-48"
          />
          <ProductDialog
            trigger={
              <Button size="md" icon={<Plus className="size-3.5" aria-hidden />}>
                New product
              </Button>
            }
          />
      </AdminPageHeader>

      {data === undefined ? (
        <Skeleton className="h-64 w-full" />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No products match"
          description="Try a different search."
        />
      ) : (
        <Card className="overflow-hidden">
          {/* The wrapper scrolls, not the page. A table that widens the body is
              how a "responsive" layout ends up with horizontal page scroll. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-line bg-surface-sunken">
                <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:label-caps">
                  <th scope="col">Product</th>
                  <th scope="col">Category</th>
                  <th scope="col" className="text-right">Price</th>
                  <th scope="col" className="text-right">Stock</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((product) => (
                  <tr
                    key={product.id}
                    className={cn(
                      "transition-colors duration-(--dur-fast) hover:bg-surface-hover",
                      !product.is_active && "opacity-60",
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-ink">{product.name}</p>
                      <p className="text-2xs text-ink-subtle">{product.slug}</p>
                    </td>
                    <td className="px-4 py-2.5 capitalize text-ink-muted">{product.category}</td>
                    <td className="tnum px-4 py-2.5 text-right text-ink">
                      {formatMoney(product.price_cents, product.currency)}
                    </td>
                    <td className="tnum px-4 py-2.5 text-right">
                      <span
                        className={cn(
                          product.stock === 0
                            ? "text-danger"
                            : product.stock <= 10
                              ? "text-warning"
                              : "text-ink",
                        )}
                      >
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {product.is_active ? (
                        <Badge tone="accent">Live</Badge>
                      ) : (
                        <Badge tone="neutral">Withdrawn</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <ProductDialog
                          product={product}
                          trigger={
                            <Button variant="ghost" size="icon" className="size-7">
                              <Pencil className="size-3.5" aria-hidden />
                              <span className="sr-only">Edit {product.name}</span>
                            </Button>
                          }
                        />
                        {product.is_active ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 hover:text-danger"
                            onClick={() => void handleDeactivate(product)}
                          >
                            <EyeOff className="size-3.5" aria-hidden />
                            <span className="sr-only">Withdraw {product.name}</span>
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Container>
  );
}

/** Rupees in the form → integer cents on the wire. The only conversion point. */
function toCents(rupees: string): number {
  return Math.round(Number.parseFloat(rupees || "0") * 100);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ProductDialog({ product, trigger }: { product?: Product; trigger: React.ReactNode }) {
  const editing = product !== undefined;
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    description: product?.description ?? "",
    price: product ? (product.price_cents / 100).toFixed(2) : "",
    category: product?.category ?? "",
    stock: product ? String(product.stock) : "0",
    image_url: product?.image_url ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const payload: ProductInput = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      description: form.description.trim(),
      price_cents: toCents(form.price),
      category: form.category.trim(),
      stock: Number.parseInt(form.stock, 10) || 0,
      image_url: form.image_url.trim() || null,
    };

    try {
      if (editing) {
        // The slug is immutable server-side — it is the product's public URL —
        // so it is not sent on an update.
        const { slug: _slug, ...changes } = payload;
        await update.mutateAsync({ id: product.id, changes });
        toast.success("Product updated");
      } else {
        await create.mutateAsync(payload);
        toast.success("Product created");
      }
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title={editing ? `Edit ${product.name}` : "New product"}
        description={
          editing
            ? "Changing the price does not alter past orders — those keep the price they were bought at."
            : "The slug becomes the product's public URL and cannot be changed later."
        }
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" size="sm" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button
              size="sm"
              type="submit"
              form="product-form"
              loading={create.isPending || update.isPending}
            >
              {editing ? "Save changes" : "Create product"}
            </Button>
          </>
        }
      >
        <form id="product-form" onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
          <Input
            label="Name"
            value={form.name}
            onChange={(event) => {
              set("name", event.target.value);
              // Auto-slug only while creating, and only if untouched — never
              // rewrite a slug the user typed themselves.
              if (!editing && !form.slug) set("slug", slugify(event.target.value));
            }}
            required
          />

          {!editing ? (
            <Input
              label="Slug"
              value={form.slug}
              onChange={(event) => set("slug", event.target.value)}
              hint="Lowercase, hyphen-separated. This is the public URL."
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
          ) : null}

          <Textarea
            label="Description"
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
            rows={3}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Price (₹)"
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(event) => set("price", event.target.value)}
              hint="Stored as integer paise."
              required
            />
            <Input
              label="Stock"
              type="number"
              min="0"
              value={form.stock}
              onChange={(event) => set("stock", event.target.value)}
              required
            />
          </div>

          <Input
            label="Category"
            value={form.category}
            onChange={(event) => set("category", event.target.value)}
            hint="Lower-cased on save."
            required
          />

          {/* Deliberately `text`, not `url`. The catalogue's own artwork is served
              from the frontend as root-relative paths (`/products/x.svg`), and
              `type="url"` rejects every one of them — the browser demands a
              scheme and a host, which is exactly what a same-origin asset does
              not have. The pattern below accepts both shapes and nothing else. */}
          <Input
            label="Image URL"
            type="text"
            inputMode="url"
            value={form.image_url}
            onChange={(event) => set("image_url", event.target.value)}
            pattern="^(https?://.+|/.*)$"
            title="An absolute https:// URL, or a root-relative path such as /products/name.svg"
            hint="A full https:// URL, or a path like /products/name.svg for bundled artwork."
          />

          {error ? (
            <p className="rounded-md bg-danger-soft px-2.5 py-2 text-xs text-danger-soft-ink" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
