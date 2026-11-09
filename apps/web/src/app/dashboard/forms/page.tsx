
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { trpc } from "../../../utils/trpc";

export default function MyFormsPage() {
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();

  const {
    data: forms,
    isLoading,
    isError,
    refetch,
  } = trpc.getMyForms.useQuery();

  const deleteForm = trpc.deleteForm.useMutation({
    onSuccess: async () => {
      await utils.getMyForms.invalidate();
    },
  });

  const handleDelete = async (formId: string, formTitle: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${formTitle}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deleteForm.mutateAsync({ formId });
    } catch (error) {
      console.error("Failed to delete form:", error);
    }
  };

  const filteredForms = useMemo(() => {
    if (!forms) return [];

    const query = search.trim().toLowerCase();

    if (!query) return forms;

    return forms.filter((form) => {
      return (
        (form.title ?? "").toLowerCase().includes(query) ||
        (form.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [forms, search]);

  return (
    <main className="min-h-screen bg-[#F8F6F0] px-4 py-8 text-[#302E29] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/dashboard"
              className="mb-3 inline-flex items-center gap-2 text-sm text-[#817B6E] transition hover:text-[#302E29]"
            >
              <span>←</span> Back to Dashboard
            </Link>

            <h1 className="text-3xl font-semibold tracking-tight">
              My Forms
            </h1>

            <p className="mt-2 text-sm text-[#817B6E]">
              Manage, edit and track all your forms in one place.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-[#302E29] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#48443D]"
          >
            + Create New Form
          </Link>
        </div>

        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#E8E2D5] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-md">
            <label
              htmlFor="form-search"
              className="mb-2 block text-sm font-medium"
            >
              Search forms
            </label>

            <input
              id="form-search"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title or description..."
              className="w-full rounded-xl border border-[#E8E2D5] bg-[#F8F6F0] px-4 py-3 text-sm outline-none transition placeholder:text-[#A29B8D] focus:border-[#817B6E]"
            />
          </div>

          <div className="text-sm text-[#817B6E]">
            <span className="font-semibold text-[#302E29]">
              {forms?.length ?? 0}
            </span>{" "}
            total forms
          </div>
        </div>

        {deleteForm.error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {deleteForm.error.message || "Unable to delete this form."}
          </div>
        )}

        {isLoading && (
          <div className="rounded-2xl border border-[#E8E2D5] bg-white p-12 text-center">
            <p className="text-sm text-[#817B6E]">
              Loading your forms...
            </p>
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-[#E8E2D5] bg-white p-8 text-center">
            <p className="font-medium text-[#302E29]">
              Unable to load your forms.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-4 rounded-xl bg-[#302E29] px-5 py-2.5 text-sm text-white transition hover:bg-[#48443D]"
            >
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !isError && forms?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#DED6C1] bg-white px-6 py-16 text-center">
            <div className="mb-4 text-4xl">▤</div>
            <h2 className="text-xl font-semibold">No forms yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#817B6E]">
              You haven't created any forms yet. Start creating your first
              form to collect responses.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex rounded-xl bg-[#302E29] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#48443D]"
            >
              Go to Dashboard
            </Link>
          </div>
        )}

        {!isLoading &&
          !isError &&
          (forms?.length ?? 0) > 0 &&
          filteredForms.length === 0 && (
            <div className="rounded-2xl border border-[#E8E2D5] bg-white p-12 text-center">
              <h2 className="font-semibold">No matching forms found</h2>
              <p className="mt-2 text-sm text-[#817B6E]">
                Try searching with a different title or keyword.
              </p>
            </div>
          )}

        {!isLoading && !isError && filteredForms.length > 0 && (
          <div className="space-y-4">
            {filteredForms.map((form) => (
              <div
                key={form.id}
                className="rounded-2xl border border-[#E8E2D5] bg-white p-5 transition hover:border-[#DED6C1] sm:p-6"
              >
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <h2 className="break-words text-lg font-semibold">
                        {form.title || "Untitled Form"}
                      </h2>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          form.status === "published"
                            ? "bg-[#E7EEE3] text-[#496443]"
                            : "bg-[#F3F0E7] text-[#817B6E]"
                        }`}
                      >
                        {form.status === "published" ? "Published" : "Draft"}
                      </span>
                    </div>

                    <p className="line-clamp-2 text-sm text-[#817B6E]">
                      {form.description || "No description added."}
                    </p>

                    <p className="mt-3 text-xs text-[#969080]">
                      Form ID: {form.id}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/forms/${form.id}`}
                      className="rounded-xl border border-[#DED6C1] px-4 py-2.5 text-sm font-medium transition hover:bg-[#F8F6F0]"
                    >
                      Edit
                    </Link>

                    <Link
                      href={`/dashboard/forms/${form.id}/responses`}
                      className="rounded-xl bg-[#302E29] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#48443D]"
                    >
                      Responses
                    </Link>

                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(form.id, form.title || "Untitled Form")
                      }
                      disabled={deleteForm.isPending}
                      className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deleteForm.isPending ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
