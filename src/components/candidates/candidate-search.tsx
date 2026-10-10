"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Spinner } from "@/components/ui/primitives";

/**
 * Search box for the candidate list.
 *
 * Typing is debounced into the URL (`?q=`), and the server re-queries with a
 * case-insensitive `ilike` against the `(organization_id, lower(full_name))`
 * index. Keeping the term in the URL means a search is shareable and survives a
 * reload, and the query stays scalable as the talent pool grows - unlike
 * filtering a fully-loaded list in the browser.
 */
export function CandidateSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? initialQuery;

  const [value, setValue] = useState(urlQuery);
  const [debouncing, setDebouncing] = useState(false);
  const [isNavigating, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * Adjust state when the URL changes from outside this component (browser
   * back/forward). This is React's documented "adjusting state when a prop
   * changes" pattern - comparing during render rather than in an effect, which
   * would cause an extra render pass.
   */
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    setValue(urlQuery);
    setDebouncing(false);
  }

  function push(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.trim()) {
      params.set("q", next.trim());
    } else {
      params.delete("q");
    }
    const query = params.toString();

    setDebouncing(false);
    // The transition stays pending until the server component has re-rendered,
    // which is exactly how long the spinner should be visible.
    startTransition(() => {
      router.replace(query ? `/candidates?${query}` : "/candidates", {
        scroll: false,
      });
    });
  }

  function onChange(next: string) {
    setValue(next);
    setDebouncing(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => push(next), 250);
  }

  function clear() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setValue("");
    push("");
  }

  const busy = debouncing || isNavigating;

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        push(value);
      }}
      className="relative w-full sm:w-72"
    >
      <label htmlFor="candidate-search" className="sr-only">
        Search candidates by name
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input
        id="candidate-search"
        name="q"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by name..."
        className="h-9 w-full rounded-lg bg-white pl-9 pr-9 text-sm text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
        {busy ? (
          <Spinner className="size-3.5 text-slate-400" />
        ) : value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clear}
            className="rounded p-0.5 text-slate-400 hover:text-slate-700"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </span>
    </form>
  );
}
