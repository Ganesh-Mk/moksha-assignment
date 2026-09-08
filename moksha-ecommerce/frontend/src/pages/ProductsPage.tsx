import { PackageSearch, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Container } from "@/components/layout/Container";
import { ProductCard, ProductCardSkeleton } from "@/components/product/ProductCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { useCategories, useProducts } from "@/hooks/useProducts";
import { cn } from "@/lib/cn";
import { pluralise } from "@/lib/format";

const PAGE_SIZE = 12;

/**
 * The catalogue.
 *
 * Filter state lives in the URL rather than in component state, which is what
 * makes a filtered view shareable, bookmarkable, and survive a refresh or a
 * back button. It also means TanStack Query's key changes with the URL, so
 * caching and refetching follow navigation for free.
 */
export function ProductsPage() {
  const [params, setParams] = useSearchParams();

  const search = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const inStockOnly = params.get("in_stock") === "1";
  const page = Math.max(1, Number(params.get("page") ?? 1));

  // Typing straight into the URL would fire a request per keystroke. The input
  // is local and debounced; the URL is the committed state.
  const [draft, setDraft] = useState(search);

  // Resync when the URL changes from somewhere other than this input — the
  // Clear button, or the browser's back button. Adjusted during render rather
  // than in an effect, which is React's documented pattern for exactly this:
  // an effect would render once with the stale value before correcting it.
  const [committedSearch, setCommittedSearch] = useState(search);
  if (search !== committedSearch) {
    setCommittedSearch(search);
    setDraft(search);
  }

  useEffect(() => {
    if (draft === search) return;
    const timer = window.setTimeout(() => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (draft) next.set("q", draft);
          else next.delete("q");
          next.delete("page"); // a new search starts at page 1
          return next;
        },
        { replace: true },
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft, search, setParams]);

  const { data: categories } = useCategories();
  const { data, isPending, isError, error, refetch } = useProducts({
    ...(search ? { search } : {}),
    ...(category ? { category } : {}),
    ...(inStockOnly ? { in_stock_only: true } : {}),
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalPages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1),
    [data],
  );

  function update(key: string, value: string | null) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  }

  const hasFilters = Boolean(search || category || inStockOnly);

  return (
    <Container className="py-8">
      <header className="mb-6">
        <p className="label-caps">The range</p>
        <h1 className="mt-1 font-display text-3xl text-ink">Haircare, honestly made</h1>
        {/* No hard-coded count: it comes from the same query the grid renders,
            so the sentence cannot drift from the catalogue the way a literal
            "twelve" did the moment the range grew. Suppressed while filtered —
            this describes the range, not the current result set. */}
        <p className="mt-1.5 max-w-md text-sm text-ink-muted">
          {data && !hasFilters ? `${data.total} products, each` : "Every product"} doing one job
          properly. Free delivery over ₹1,500.
        </p>
      </header>

      <div className="mb-5 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-end">
        <div className="sm:max-w-64 sm:flex-1">
          <Input
            label="Search products"
            hideLabel
            type="search"
            placeholder="Search the range…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            adornment={<Search className="size-3.5" />}
          />
        </div>

        {/* Scrolls sideways on mobile rather than wrapping.
            Wrapping pushed the product grid down by a whole row on a phone, which is the most
            valuable space on the page. The negative margin plus matching padding lets the row
            bleed to the screen edge, so the last pill is visibly cut off — that is the cue that
            there is more to the right. From `sm` up there is room to wrap normally. */}
        <div
          className={cn(
            "no-scrollbar flex items-center gap-1.5",
            "-mx-4 overflow-x-auto px-4",
            // `overflow-x: auto` forces `overflow-y` to compute to `auto` too —
            // CSS will not let one axis clip while the other stays visible. The
            // pills were losing a couple of pixels off the bottom to that. The
            // self-cancelling vertical padding gives them room without moving
            // anything on the page.
            "-my-1.5 py-1.5",
            "sm:mx-0 sm:my-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:py-0",
          )}
        >
          <FilterChip active={!category} onClick={() => update("category", null)}>
            All
          </FilterChip>
          {categories?.map((name) => (
            <FilterChip
              key={name}
              active={category === name}
              onClick={() => update("category", category === name ? null : name)}
            >
              {name}
            </FilterChip>
          ))}
          <FilterChip
            active={inStockOnly}
            onClick={() => update("in_stock", inStockOnly ? null : "1")}
          >
            In stock
          </FilterChip>
        </div>

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            className="sm:ml-auto"
            onClick={() => setParams(new URLSearchParams())}
            icon={<X className="size-3" />}
          >
            Clear
          </Button>
        ) : null}
      </div>

      {/* A live region so a screen-reader user hears the result count change
          after filtering, rather than the grid silently swapping underneath. */}
      <p className="sr-only" role="status">
        {data ? `${pluralise(data.total, "product")} found` : "Loading products"}
      </p>

      {isError ? (
        <EmptyState
          icon={PackageSearch}
          title="Could not load the catalogue"
          description={error.message}
          action={
            <Button variant="secondary" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      ) : isPending ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: PAGE_SIZE }, (_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Nothing matches those filters"
          description="Try a different search, or clear the filters to see everything."
          action={
            <Button variant="secondary" size="sm" onClick={() => setParams(new URLSearchParams())}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {data.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {totalPages > 1 ? (
            <nav
              className="mt-6 flex items-center justify-between border-t border-line pt-4"
              aria-label="Pagination"
            >
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => update("page", String(page - 1))}
              >
                Previous
              </Button>
              <p className="text-xs tabular-nums text-ink-muted">
                Page {page} of {totalPages} · {pluralise(data.total, "product")}
              </p>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => update("page", String(page + 1))}
              >
                Next
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </Container>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        // h-9 matches the search input. Two heights side by side read as two unrelated
        // controls; one height reads as a single filter strip.
        "h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-xs capitalize",
        "transition-[background-color,border-color,color] duration-[--dur-fast]",
        active
          ? "border-accent bg-accent text-accent-ink"
          : "border-line-strong bg-surface text-ink-muted hover:border-ink-subtle hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
