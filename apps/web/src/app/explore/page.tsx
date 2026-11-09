
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { trpc } from "../../utils/trpc";

export default function ExplorePage() {
  const [search, setSearch] = useState("");

  const {
    data: forms,
    isLoading,
    isError,
    refetch,
  } = trpc.getPublicForms.useQuery();

  const filteredForms = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return forms ?? [];

    return (forms ?? []).filter(
      (form) =>
        form.title.toLowerCase().includes(query) ||
        (form.description ?? "").toLowerCase().includes(query)
    );
  }, [forms, search]);

  return (
    <main className="min-h-screen bg-[#ebe2cc] text-[#39362f]">
      {/* Header */}
      <header className="border-b border-[#cfc6b1] bg-[#ded6c1]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight text-[#39362f]"
          >
            FormFlow<span className="text-[#8d8068]">.</span>
          </Link>

          <nav className="flex items-center gap-5 text-sm font-medium">
            <Link
              href="/explore"
              className="text-[#514b40] hover:text-[#81745f]"
            >
              Explore
            </Link>

            <Link
              href="/dashboard"
              className="rounded-lg bg-[#b7b09e] px-4 py-2.5 text-[#39362f] transition hover:bg-[#aaa28f]"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pb-12 pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full border border-[#b7b09e] bg-[#ded6c1] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#756c5b]">
            FormFlow Community
          </span>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-[#39362f] sm:text-5xl">
            Explore Public Forms
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#756c5b]">
            Discover forms created by the community. Explore,
            participate and share your responses.
          </p>
        </div>

        {/* Search */}
        <div className="mx-auto mt-10 max-w-2xl">
          <div className="flex items-center gap-3 rounded-2xl border border-[#cfc6b1] bg-[#f5efdf] px-5 py-4 shadow-sm transition focus-within:border-[#968a73]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-[#81745f]"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search forms by title or description..."
              className="w-full bg-transparent text-sm text-[#39362f] outline-none placeholder:text-[#a49b88]"
            />

            {search && (
              <button
                onClick={() => setSearch("")}
                className="shrink-0 text-sm text-[#81745f] hover:text-[#39362f]"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Forms */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#cfc6b1] border-t-[#81745f]" />
            <p className="mt-4 text-sm text-[#81745f]">
              Loading public forms...
            </p>
          </div>
        ) : isError ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-[#cfc6b1] bg-[#ded6c1] p-10 text-center">
            <h2 className="text-xl font-semibold">
              Something went wrong
            </h2>

            <p className="mt-2 text-sm text-[#756c5b]">
              We couldn't load public forms. Please try again.
            </p>

            <button
              onClick={() => refetch()}
              className="mt-6 rounded-xl bg-[#81745f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#6e6250]"
            >
              Try Again
            </button>
          </div>
        ) : filteredForms.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-[#cfc6b1] bg-[#ded6c1] px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#cfc6b1] text-2xl">
              {search ? "⌕" : "✦"}
            </div>

            <h2 className="mt-5 text-xl font-bold">
              {search
                ? "No matching forms found"
                : "No public forms yet"}
            </h2>

            <p className="mt-2 text-sm text-[#756c5b]">
              {search
                ? "Try another keyword to find what you're looking for."
                : "Published public forms will appear here."}
            </p>

            {search && (
              <button
                onClick={() => setSearch("")}
                className="mt-5 text-sm font-semibold text-[#756c5b] underline underline-offset-4 hover:text-[#39362f]"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">
                  Discover Forms
                </h2>
                <p className="mt-1 text-sm text-[#81745f]">
                  Find something interesting to explore.
                </p>
              </div>

              <span className="rounded-full border border-[#cfc6b1] bg-[#ded6c1] px-4 py-2 text-sm font-medium text-[#756c5b]">
                {filteredForms.length}{" "}
                {filteredForms.length === 1 ? "form" : "forms"}
              </span>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredForms.map((form) => (
                <article
                  key={form.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[#cfc6b1] bg-[#f5efdf] shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="h-2 bg-[#b7b09e]" />

                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-[#ded6c1] px-3 py-1 text-xs font-semibold text-[#756c5b]">
                        Public Form
                      </span>

                      <span className="text-xs text-[#a49b88]">
                        FormFlow
                      </span>
                    </div>

                    <h3 className="mt-6 break-words text-xl font-bold text-[#39362f] transition group-hover:text-[#81745f]">
                      {form.title}
                    </h3>

                    <p className="mt-3 min-h-12 flex-1 break-words text-sm leading-6 text-[#756c5b]">
                      {form.description || "No description provided."}
                    </p>

                    <div className="mt-7 border-t border-[#ded6c1] pt-5">
                      <Link
                        href={`/forms/${form.slug}`}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#81745f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#6e6250]"
                      >
                        Fill This Form
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-[#cfc6b1] bg-[#ded6c1]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-7 sm:flex-row">
          <p className="text-sm font-semibold text-[#514b40]">
            FormFlow.
          </p>

          <p className="text-xs text-[#81745f]">
            Create. Share. Collect. Powered by FormFlow.
          </p>

          <Link
            href="/dashboard"
            className="text-sm font-medium text-[#756c5b] transition hover:text-[#39362f]"
          >
            Create your own form →
          </Link>
        </div>
      </footer>
    </main>
  );
}
