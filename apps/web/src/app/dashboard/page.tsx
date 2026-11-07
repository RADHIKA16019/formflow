
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

const navigation = [
  { label: "Overview", icon: "◫", active: true },
  { label: "My Forms", icon: "▤", active: false },
  { label: "Templates", icon: "▧", active: false },
  { label: "Explore", icon: "⌕", active: false },
  { label: "Analytics", icon: "▥", active: false },
];

export default function DashboardPage() {
  const router = useRouter();

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form input states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Authentication
  const { data: session, isPending } = authClient.useSession();

  const {
    data: profile,
    isLoading: isProfileLoading,
  } = trpc.getProfile.useQuery(undefined, {
    enabled: !!session,
  });

  // Fetch user's forms
  const {
    data: forms,
    isLoading: areFormsLoading,
    isError: formsError,
  } = trpc.getMyForms.useQuery(undefined, {
    enabled: !!session,
  });

  // tRPC utilities for refreshing queries
  const utils = trpc.useUtils();

  // Create form mutation
  const createFormMutation = trpc.createForm.useMutation({
    onSuccess: async () => {
      // Refresh forms list after successful creation
      await utils.getMyForms.invalidate();

      // Close modal and reset inputs
      setIsCreateModalOpen(false);
      setTitle("");
      setDescription("");
    },
  });

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login");
    }
  }, [session, isPending, router]);

  // Logout
  const handleLogout = async () => {
    await authClient.signOut();
    window.location.assign("/login");
  };

  // Handle form creation
  const handleCreateForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    createFormMutation.mutate({
      title,
      description: description.trim() || undefined,
    });
  };

  // Loading screen
  if (isPending || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Loading your workspace...
      </div>
    );
  }

  // Statistics
  const totalForms = forms?.length ?? 0;

  const publishedForms =
    forms?.filter((form) => form.status === "published").length ?? 0;

  const stats = [
    {
      label: "Total Forms",
      value: areFormsLoading ? "..." : String(totalForms),
      description: "Forms created",
    },
    {
      label: "Total Responses",
      value: "0",
      description: "Responses received",
    },
    {
      label: "Published Forms",
      value: areFormsLoading ? "..." : String(publishedForms),
      description: "Currently live",
    },
  ];

  const recentForms = forms?.slice(0, 5) ?? [];

  return (
    <div className="flex min-h-screen bg-white">

      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-white px-5 py-7 md:flex">

        <Link href="/dashboard" className="mb-12 px-3">
          <span className="text-2xl font-bold tracking-tight">
            Form<span className="text-stone">Flow</span>
          </span>
        </Link>

        <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted">
          Workspace
        </p>

        <nav className="space-y-1">
          {navigation.map((item) => (
            <div
              key={item.label}
              className={`flex cursor-default items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${
                item.active
                  ? "bg-cream text-foreground"
                  : "text-muted"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-border pt-5">
          <div className="mb-4 px-3">
            <p className="text-sm font-semibold">
              {session.user.name}
            </p>

            <p className="mt-1 truncate text-xs text-muted">
              {session.user.email}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-muted transition hover:bg-cream hover:text-foreground"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1">

        {/* Header */}
        <header className="flex flex-col justify-between gap-4 border-b border-border px-6 py-6 sm:flex-row sm:items-center sm:px-10">

          <div>
            <p className="text-sm text-muted">
              Workspace / Overview
            </p>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Welcome back, {session.user.name.split(" ")[0]}
            </h1>

            <p className="mt-1 text-sm text-muted">
              Here&apos;s what&apos;s happening with your forms.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="w-fit rounded-lg bg-[#CFC6B1] px-5 py-3 text-sm font-semibold text-[#302E29] transition hover:bg-[#B7B09E]"
          >
            + Create new form
          </button>
        </header>

        {/* Dashboard Body */}
        <div className="space-y-10 px-6 py-8 sm:px-10">

          {/* Statistics */}
          <section>
            <h2 className="mb-5 text-base font-semibold">
              Overview
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-border bg-white p-6"
                >
                  <p className="text-sm text-muted">
                    {stat.label}
                  </p>

                  <p className="mt-4 text-3xl font-semibold tracking-tight">
                    {stat.value}
                  </p>

                  <p className="mt-2 text-xs text-muted">
                    {stat.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Forms */}
          <section>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">
                  Recent Forms
                </h2>

                <p className="mt-1 text-sm text-muted">
                  Your recently created forms.
                </p>
              </div>
            </div>

            {areFormsLoading ? (
              <div className="flex min-h-64 items-center justify-center rounded-xl border border-border text-sm text-muted">
                Loading your forms...
              </div>
            ) : formsError ? (
              <div className="flex min-h-64 items-center justify-center rounded-xl border border-red-200 text-sm text-red-600">
                Failed to load forms. Please refresh the page.
              </div>
            ) : recentForms.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[#CFC6B1] px-6 py-12 text-center">

                <div className="flex size-14 items-center justify-center rounded-xl bg-[#EBE2CC] text-2xl">
                  +
                </div>

                <h3 className="mt-5 text-base font-semibold">
                  No forms yet
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
                  Your forms will appear here. Create your first
                  form and start collecting responses.
                </p>

                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-5 rounded-lg bg-[#CFC6B1] px-5 py-2.5 text-sm font-semibold hover:bg-[#B7B09E]"
                >
                  Create your first form
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentForms.map((form) => (
                  <div
                    key={form.id}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-white p-5 sm:flex-row sm:items-center"
                  >
                    <div>
                      <h3 className="font-semibold">
                        {form.title}
                      </h3>

                      <p className="mt-1 text-sm text-muted">
                        {form.description || "No description"}
                      </p>

                      <p className="mt-2 text-xs text-muted">
                        Created{" "}
                        {new Date(form.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-medium capitalize ${
                        form.status === "published"
                          ? "bg-green-50 text-green-700"
                          : form.status === "archived"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-cream text-foreground"
                      }`}
                    >
                      {form.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Authentication Status */}
          <p className="text-xs text-muted">
            {isProfileLoading
              ? "Verifying workspace..."
              : profile?.message ?? "Workspace connected"}
          </p>
        </div>
      </main>

      {/* Create Form Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">

          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">

            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Create a new form
                </h2>

                <p className="mt-1 text-sm text-muted">
                  Give your form a name to get started.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  createFormMutation.reset();
                }}
                className="text-xl text-muted hover:text-foreground"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleCreateForm}
              className="space-y-5"
            >

              {/* Form Title */}
              <div>
                <label
                  htmlFor="form-title"
                  className="mb-2 block text-sm font-medium"
                >
                  Form title *
                </label>

                <input
                  id="form-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Customer Feedback"
                  maxLength={100}
                  required
                  className="w-full rounded-lg border border-border px-4 py-3 text-sm outline-none transition focus:border-[#B7B09E]"
                />
              </div>

              {/* Form Description */}
              <div>
                <label
                  htmlFor="form-description"
                  className="mb-2 block text-sm font-medium"
                >
                  Description
                </label>

                <textarea
                  id="form-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this form about?"
                  maxLength={500}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border px-4 py-3 text-sm outline-none transition focus:border-[#B7B09E]"
                />
              </div>

              {/* Error Message */}
              {createFormMutation.isError && (
                <p className="text-sm text-red-600">
                  {createFormMutation.error.message}
                </p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">

                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    createFormMutation.reset();
                  }}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-cream"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    createFormMutation.isPending ||
                    !title.trim()
                  }
                  className="rounded-lg bg-[#CFC6B1] px-5 py-2.5 text-sm font-semibold text-[#302E29] transition hover:bg-[#B7B09E] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createFormMutation.isPending
                    ? "Creating..."
                    : "Create form"}
                </button>

              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
