
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const navigation = [
  { label: "Overview", icon: "◫", href: "/dashboard", active: true },
  { label: "My Forms", icon: "▤", href: "/dashboard/forms", active: false },
  { label: "Templates", icon: "▧", href: "/dashboard/templates", active: false },
  { label: "Explore", icon: "⌕", href: "/explore", active: false },
  { label: "Analytics", icon: "▥", href: "/dashboard/analytics", active: false },
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

  // Fetch total responses
  const {
    data: totalResponses,
    isLoading: areResponsesLoading,
  } = trpc.getTotalResponses.useQuery(undefined, {
    enabled: !!session,
  });

  // Fetch response analytics
  const {
    data: analyticsData,
    isLoading: isAnalyticsLoading,
  } = trpc.getResponseAnalytics.useQuery(undefined, {
    enabled: !!session,
  });

    // Notifications
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const {
    data: notificationsList,
  } = trpc.getNotifications.useQuery(undefined, {
    enabled: !!session,
    refetchInterval: 30_000,
  });

  const {
    data: unreadCount = 0,
  } = trpc.getUnreadCount.useQuery(undefined, {
    enabled: !!session,
    refetchInterval: 30_000,
  });

  // tRPC utilities
  const utils = trpc.useUtils();

    const markAsReadMutation = trpc.markAsRead.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.getNotifications.invalidate(),
        utils.getUnreadCount.invalidate(),
      ]);
    },
  });

  const markAllAsReadMutation = trpc.markAllAsRead.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.getNotifications.invalidate(),
        utils.getUnreadCount.invalidate(),
      ]);
    },
  });

  const handleNotificationClick = (notification: NonNullable<typeof notificationsList>[number]) => {
    if (!notification.readAt) {
      markAsReadMutation.mutate(
        { notificationId: notification.id },
        {
          onSuccess: () => {
            router.push(
              `/dashboard/forms/${notification.formId}/responses`
            );
          },
        }
      );
    } else {
      router.push(
        `/dashboard/forms/${notification.formId}/responses`
      );
    }

    setIsNotificationsOpen(false);
  };

  // Create form mutation
  const createFormMutation = trpc.createForm.useMutation({
    onSuccess: async () => {
      await utils.getMyForms.invalidate();

      setIsCreateModalOpen(false);
      setTitle("");
      setDescription("");
    },
  });

  // Clone form mutation
  const cloneFormMutation = trpc.cloneForm.useMutation({
    onSuccess: async (clonedForm) => {
      await utils.getMyForms.invalidate();
      router.push(`/dashboard/forms/${clonedForm.id}`);
    },
  });

  // Archive form mutation
  const archiveFormMutation = trpc.archiveForm.useMutation({
    onSuccess: async () => {
      await utils.getMyForms.invalidate();
    },
  });

  // Restore form mutation
  const restoreFormMutation = trpc.restoreForm.useMutation({
    onSuccess: async () => {
      await utils.getMyForms.invalidate();
    },
  });

  // Permanently delete form mutation
const deleteFormMutation = trpc.deleteForm.useMutation({
  onSuccess: async () => {
    await Promise.all([
      utils.getMyForms.invalidate(),
      utils.getTotalResponses.invalidate(),
      utils.getResponseAnalytics.invalidate(),
    ]);
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

    if (!title.trim()) return;

    createFormMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
    });
  };

  // Loading screen
  if (isPending || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F6F0] text-sm text-[#777367]">
        Loading your workspace...
      </div>
    );
  }

  // Separate active and archived forms
  const activeForms = forms?.filter((form) => !form.archivedAt) ?? [];

  const archivedForms = forms?.filter((form) => !!form.archivedAt) ?? [];

  // Statistics
  const totalForms = activeForms.length;

  const publishedForms = activeForms.filter(
    (form) => form.status === "published"
  ).length;

  const stats = [
    {
      label: "Total Forms",
      value: areFormsLoading ? "..." : String(totalForms),
      description: "Active forms",
      icon: "▤",
    },
    {
      label: "Total Responses",
      value: areResponsesLoading
        ? "..."
        : String(totalResponses ?? 0),
      description: "Responses received",
      icon: "↗",
    },
    {
      label: "Published Forms",
      value: areFormsLoading ? "..." : String(publishedForms),
      description: "Currently live",
      icon: "◉",
    },
  ];

  const recentForms = activeForms.slice(0, 5);

  return (
    <div className="min-h-screen bg-[#F8F6F0] text-[#302E29]">
      <div className="flex min-h-screen">

        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-[#E8E2D5] bg-[#F3F0E7] px-5 py-7 lg:flex lg:flex-col">

          <Link href="/dashboard" className="mb-12 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#302E29] text-lg font-bold text-white">
              F
            </div>
            <span className="text-xl font-bold tracking-tight">
              FormFlow
            </span>
          </Link>

          <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-widest text-[#969080]">
            Workspace
          </p>

          <nav className="space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  item.active
                    ? "bg-[#302E29] text-white"
                    : "text-[#716C60] hover:bg-[#E8E2D5]"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl bg-[#E8E2D5] p-4">
            <p className="text-sm font-semibold">Need some help?</p>
            <p className="mt-2 text-xs leading-5 text-[#716C60]">
              Create beautiful forms and collect responses with FormFlow.
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="min-w-0 flex-1 px-5 py-7 sm:px-8 lg:px-10">

          {/* Header */}
          <header className="mb-10 flex flex-wrap items-center justify-between gap-4">

            <div>
              <p className="text-sm text-[#969080]">
                Workspace / Overview
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Dashboard
              </h1>
              <p className="mt-2 text-sm text-[#817B6E]">
                Manage your forms and track your responses.
              </p>
            </div>

            <div className="flex items-center gap-3">
                            {/* Notification Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setIsNotificationsOpen(!isNotificationsOpen)
                  }
                  className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-[#DED6C1] bg-white text-xl transition hover:bg-[#EEEAE0]"
                  aria-label="Notifications"
                >
                  ♧

                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div className="absolute right-0 top-full z-50 mt-3 w-[min(90vw,380px)] overflow-hidden rounded-2xl border border-[#E8E2D5] bg-white shadow-xl">

                    <div className="flex items-center justify-between border-b border-[#E8E2D5] p-4">
                      <div>
                        <h3 className="font-semibold">
                          Notifications
                        </h3>
                        <p className="mt-1 text-xs text-[#969080]">
                          {unreadCount} unread notifications
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          markAllAsReadMutation.mutate()
                        }
                        disabled={
                          unreadCount === 0 ||
                          markAllAsReadMutation.isPending
                        }
                        className="text-xs font-semibold text-[#756B52] hover:underline disabled:opacity-40"
                      >
                        Mark all as read
                      </button>
                    </div>

                    <div className="max-h-[380px] overflow-y-auto">
                      {!notificationsList ||
                      notificationsList.length === 0 ? (
                        <div className="p-10 text-center">
                          <p className="text-3xl">♧</p>
                          <p className="mt-3 text-sm font-semibold">
                            No notifications yet
                          </p>
                          <p className="mt-1 text-xs text-[#969080]">
                            New form responses will appear here.
                          </p>
                        </div>
                      ) : (
                        notificationsList.map((notification) => (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() =>
                              handleNotificationClick(notification)
                            }
                            className={`w-full border-b border-[#F0EDE4] p-4 text-left transition hover:bg-[#F8F6F0] ${
                              !notification.readAt
                                ? "bg-[#F8F6F0]"
                                : "bg-white"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="mt-1 text-lg">
                                {notification.readAt ? "○" : "●"}
                              </span>

                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold">
                                  {notification.title}
                                </p>

                                <p className="mt-1 text-xs text-[#716C60]">
                                  {notification.message}
                                </p>

                                <p className="mt-2 text-xs font-medium text-[#969080]">
                                  {notification.formTitle}
                                </p>

                                <p className="mt-1 text-[11px] text-[#A39D90]">
                                  {new Date(
                                    notification.createdAt
                                  ).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="rounded-xl bg-[#302E29] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#49453D]"
              >
                + Create Form
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-[#DED6C1] px-4 py-3 text-sm font-semibold text-[#514D43] transition hover:bg-[#EEEAE0]"
              >
                Logout
              </button>
            </div>
          </header>

          {/* Welcome */}
          <section className="mb-9">
            <h2 className="text-xl font-semibold">
              Welcome back,{" "}
              {session.user.name || "there"}!
            </h2>
            <p className="mt-1 text-sm text-[#817B6E]">
              Here&apos;s what is happening in your workspace.
            </p>
          </section>

          {/* Statistics */}
          <section className="mb-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-[#E8E2D5] bg-white p-6 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[#817B6E]">
                    {stat.label}
                  </p>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F0E7] text-xl">
                    {stat.icon}
                  </span>
                </div>

                <p className="mt-5 text-3xl font-bold tracking-tight">
                  {stat.value}
                </p>

                <p className="mt-2 text-xs text-[#969080]">
                  {stat.description}
                </p>
              </div>
            ))}
          </section>

          {/* Analytics */}
          <section className="mb-10 rounded-2xl border border-[#E8E2D5] bg-white p-6 shadow-sm">

            <div className="mb-7">
              <h2 className="text-lg font-semibold">
                Responses Over Time
              </h2>
              <p className="mt-1 text-sm text-[#969080]">
                Track how people are responding to your forms.
              </p>
            </div>

            {isAnalyticsLoading ? (
              <div className="flex h-64 items-center justify-center text-sm text-[#969080]">
                Loading analytics...
              </div>
            ) : analyticsData && analyticsData.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#EAE5D9"
                    />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#969080", fontSize: 12 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#969080", fontSize: 12 }}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="responses"
                      stroke="#81765D"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#81765D" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <span className="text-4xl">▥</span>
                <p className="mt-4 font-semibold">
                  No analytics yet
                </p>
                <p className="mt-2 text-sm text-[#969080]">
                  Responses will appear here once people submit your forms.
                </p>
              </div>
            )}
          </section>

          {/* Recent Forms */}
          <section className="mb-10">

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  Recent Forms
                </h2>
                <p className="mt-1 text-sm text-[#969080]">
                  Your recently created forms.
                </p>
              </div>

              <Link
                href="/dashboard/forms"
                className="text-sm font-semibold text-[#756B52] hover:underline"
              >
                View all forms →
              </Link>
            </div>

            {areFormsLoading ? (
              <div className="rounded-2xl border border-[#E8E2D5] bg-white p-10 text-center text-sm text-[#969080]">
                Loading forms...
              </div>
            ) : formsError ? (
              <div className="rounded-2xl border border-red-200 bg-white p-8 text-center text-sm text-red-600">
                Unable to load your forms. Please refresh the page.
              </div>
            ) : recentForms.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#CFC6B1] bg-white p-12 text-center">
                <span className="text-4xl">▤</span>
                <h3 className="mt-4 font-semibold">
                  No forms created yet
                </h3>
                <p className="mt-2 text-sm text-[#969080]">
                  Create your first form to start collecting responses.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-5 rounded-xl bg-[#302E29] px-5 py-3 text-sm font-semibold text-white hover:bg-[#49453D]"
                >
                  Create your first form
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentForms.map((form) => (
                  <div
                    key={form.id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-[#E8E2D5] bg-white p-5 shadow-sm sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="truncate font-semibold">
                          {form.title}
                        </h3>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            form.status === "published"
                              ? "bg-green-100 text-green-700"
                              : "bg-[#F0EDE4] text-[#777064]"
                          }`}
                        >
                          {form.status}
                        </span>
                      </div>

                      <p className="mt-2 truncate text-sm text-[#969080]">
                        {form.description || "No description"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">

                      <Link
  href={`/dashboard/forms/${form.id}`}
  className="rounded-lg border border-[#DED6C1] px-4 py-2 text-sm font-semibold hover:bg-[#F8F6F0]"
>
  Edit
</Link>
                      <Link
                        href={`/dashboard/forms/${form.id}/responses`}
                        className="rounded-lg bg-[#302E29] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#49453D]"
                      >
                        Responses
                      </Link>

                      <button
                        type="button"
                        onClick={() =>
                          cloneFormMutation.mutate({
                            formId: form.id,
                          })
                        }
                        disabled={
                          cloneFormMutation.isPending ||
                          archiveFormMutation.isPending
                        }
                        className="rounded-lg border border-[#DED6C1] px-4 py-2 text-sm font-semibold hover:bg-[#F8F6F0] disabled:opacity-50"
                      >
                        {cloneFormMutation.isPending ? "Cloning..." : "Clone"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Archive "${form.title}"?`)) {
                            archiveFormMutation.mutate({
                              formId: form.id,
                            });
                          }
                        }}
                        disabled={archiveFormMutation.isPending}
                        className="rounded-lg border border-[#DED6C1] px-4 py-2 text-sm font-semibold hover:bg-[#F8F6F0] disabled:opacity-50"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Archived Forms */}
          <section className="mb-10">

            <div className="mb-5">
              <h2 className="text-lg font-semibold">
                Archived Forms ({archivedForms.length})
              </h2>
              <p className="mt-1 text-sm text-[#969080]">
                Forms that you have archived. You can restore them anytime.
              </p>
            </div>

            {archivedForms.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#CFC6B1] bg-white p-8 text-center">
                <p className="text-sm text-[#969080]">
                  No archived forms yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {archivedForms.map((form) => (
                  <div
                    key={form.id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-[#E8E2D5] bg-white p-5 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <h3 className="font-semibold">
                        {form.title}
                      </h3>

                      <p className="mt-1 text-sm text-[#969080]">
                        {form.description || "No description"}
                      </p>

                      <p className="mt-2 text-xs text-[#969080]">
                        Archived{" "}
                        {new Date(form.archivedAt!).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          restoreFormMutation.mutate({
                            formId: form.id,
                          })
                        }
                        disabled={restoreFormMutation.isPending}
                        className="rounded-lg bg-[#CFC6B1] px-4 py-2 text-sm font-semibold text-[#302E29] transition hover:bg-[#B7B09E] disabled:opacity-50"
                      >
                        {restoreFormMutation.isPending
                          ? "Restoring..."
                          : "Restore"}
                      </button>
                      <button
  type="button"
  onClick={() => {
    if (
      window.confirm(
        `Permanently delete "${form.title}"? This action cannot be undone.`
      )
    ) {
      deleteFormMutation.mutate({
        formId: form.id,
      });
    }
  }}
  disabled={deleteFormMutation.isPending}
  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
>
  {deleteFormMutation.isPending ? "Deleting..." : "Delete Permanently"}
</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Account Information */}
          <section className="rounded-2xl border border-[#E8E2D5] bg-white p-6 shadow-sm">
            <h2 className="font-semibold">
              Account Information
            </h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-[#969080]">Name</p>
                <p className="mt-1 text-sm font-medium">
                  {session.user.name || "Not available"}
                </p>
              </div>

              <div>
                <p className="text-xs text-[#969080]">Email</p>
                <p className="mt-1 text-sm font-medium">
                  {session.user.email}
                </p>
              </div>
            </div>
          </section>

          <footer className="py-8 text-center text-xs text-[#969080]">
            © {new Date().getFullYear()} FormFlow. All rights reserved.
          </footer>
        </main>
      </div>

      {/* Create Form Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
          <div className="w-full max-w-lg rounded-2xl bg-white p-7 shadow-2xl">

            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  Create a new form
                </h2>
                <p className="mt-1 text-sm text-[#969080]">
                  Start collecting responses.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg px-3 py-2 text-xl text-[#817B6E] hover:bg-[#F3F0E7]"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateForm} className="space-y-5">

              <div>
                <label
                  htmlFor="form-title"
                  className="mb-2 block text-sm font-semibold"
                >
                  Form title
                </label>

                <input
                  id="form-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Customer Feedback"
                  required
                  className="w-full rounded-xl border border-[#DED6C1] px-4 py-3 text-sm outline-none transition focus:border-[#81765D] focus:ring-2 focus:ring-[#81765D]/10"
                />
              </div>

              <div>
                <label
                  htmlFor="form-description"
                  className="mb-2 block text-sm font-semibold"
                >
                  Description (optional)
                </label>

                <textarea
                  id="form-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell people what this form is about..."
                  rows={4}
                  className="w-full resize-none rounded-xl border border-[#DED6C1] px-4 py-3 text-sm outline-none transition focus:border-[#81765D] focus:ring-2 focus:ring-[#81765D]/10"
                />
              </div>

              {createFormMutation.error && (
                <p className="text-sm text-red-600">
                  {createFormMutation.error.message}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-[#DED6C1] px-5 py-3 text-sm font-semibold hover:bg-[#F8F6F0]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    createFormMutation.isPending ||
                    !title.trim()
                  }
                  className="rounded-xl bg-[#302E29] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#49453D] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createFormMutation.isPending
                    ? "Creating..."
                    : "Create Form"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
