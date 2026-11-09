
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
  { label: "Overview", icon: "◫", href: "/dashboard" },
  { label: "My Forms", icon: "▤", href: "/dashboard/forms" },
  { label: "Templates", icon: "▧", href: "/dashboard/templates" },
  { label: "Explore", icon: "⌕", href: "/explore" },
  { label: "Analytics", icon: "▥", href: "/dashboard/analytics" },
];

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-IN").format(value);

export default function DashboardPage() {
  const router = useRouter();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const { data: session, isPending } = authClient.useSession();

  const { data: profile } = trpc.getProfile.useQuery(undefined, {
    enabled: !!session,
  });

  const {
    data: forms,
    isLoading: areFormsLoading,
    isError: formsError,
  } = trpc.getMyForms.useQuery(undefined, {
    enabled: !!session,
  });

  const {
    data: totalResponses,
    isLoading: areResponsesLoading,
  } = trpc.getTotalResponses.useQuery(undefined, {
    enabled: !!session,
  });

  const {
    data: analyticsData,
    isLoading: isAnalyticsLoading,
  } = trpc.getResponseAnalytics.useQuery(undefined, {
    enabled: !!session,
  });

  // Subscription and usage
  const {
    data: subscription,
    isLoading: isSubscriptionLoading,
    isError: subscriptionError,
  } = trpc.getMySubscription.useQuery(undefined, {
    enabled: !!session,
    refetchInterval: 30_000,
  });

  // Notifications
  const { data: notificationsList } =
    trpc.getNotifications.useQuery(undefined, {
      enabled: !!session,
      refetchInterval: 30_000,
    });

  const { data: unreadCount = 0 } =
    trpc.getUnreadCount.useQuery(undefined, {
      enabled: !!session,
      refetchInterval: 30_000,
    });

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

  const createFormMutation = trpc.createForm.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.getMyForms.invalidate(),
        utils.getMySubscription.invalidate(),
      ]);

      setIsCreateModalOpen(false);
      setTitle("");
      setDescription("");
    },
  });

  const cloneFormMutation = trpc.cloneForm.useMutation({
    onSuccess: async (clonedForm) => {
      await Promise.all([
        utils.getMyForms.invalidate(),
        utils.getMySubscription.invalidate(),
      ]);

      router.push(`/dashboard/forms/${clonedForm.id}`);
    },
  });

  const archiveFormMutation = trpc.archiveForm.useMutation({
    onSuccess: async () => {
      await utils.getMyForms.invalidate();
    },
  });

  const restoreFormMutation = trpc.restoreForm.useMutation({
    onSuccess: async () => {
      await utils.getMyForms.invalidate();
    },
  });

  const deleteFormMutation = trpc.deleteForm.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.getMyForms.invalidate(),
        utils.getTotalResponses.invalidate(),
        utils.getResponseAnalytics.invalidate(),
        utils.getMySubscription.invalidate(),
      ]);
    },
  });

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login");
    }
  }, [session, isPending, router]);

  const handleLogout = async () => {
    await authClient.signOut();
    window.location.assign("/login");
  };

  const handleCreateForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!title.trim()) return;

    createFormMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
    });
  };

  const handleNotificationClick = (
    notification: NonNullable<typeof notificationsList>[number]
  ) => {
    const destination = `/dashboard/forms/${notification.formId}/responses`;

    if (!notification.readAt) {
      markAsReadMutation.mutate(
        { notificationId: notification.id },
        {
          onSuccess: () => router.push(destination),
        }
      );
    } else {
      router.push(destination);
    }

    setIsNotificationsOpen(false);
  };

  if (isPending || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F6F0] text-sm text-[#777367]">
        Loading your workspace...
      </div>
    );
  }

  const activeForms = forms?.filter((form) => !form.archivedAt) ?? [];
  const archivedForms = forms?.filter((form) => !!form.archivedAt) ?? [];

  const publishedForms = activeForms.filter(
    (form) => form.status === "published"
  ).length;

  const stats = [
    {
      label: "Active Forms",
      value: areFormsLoading ? "..." : formatNumber(activeForms.length),
      description: "Forms in your workspace",
      icon: "▤",
    },
    {
      label: "Total Responses",
      value: areResponsesLoading
        ? "..."
        : formatNumber(totalResponses ?? 0),
      description: "All-time submissions",
      icon: "↗",
    },
    {
      label: "Published Forms",
      value: areFormsLoading ? "..." : formatNumber(publishedForms),
      description: "Currently collecting responses",
      icon: "◉",
    },
  ];

  const recentForms = activeForms.slice(0, 5);

  const formLimit = subscription?.limits.forms ?? null;
  const responseLimit = subscription?.limits.responses ?? 100;

  const formsUsed = subscription?.totalForms ?? 0;
  const responsesUsed = subscription?.monthlyResponsesUsed ?? 0;

  const formPercentage =
    formLimit === null
      ? 0
      : Math.min((formsUsed / formLimit) * 100, 100);

  const responsePercentage = Math.min(
    (responsesUsed / responseLimit) * 100,
    100
  );

  const planName = subscription?.plan
    ? subscription.plan.charAt(0).toUpperCase() +
      subscription.plan.slice(1)
    : "Free";

  return (
    <div className="min-h-screen bg-[#F8F6F0] text-[#302E29]">
      <div className="flex min-h-screen">

        {/* Sidebar */}
        <aside className="hidden w-[230px] shrink-0 border-r border-[#E8E2D5] bg-[#F3F0E7] px-5 py-7 lg:flex lg:flex-col">
          <Link href="/dashboard" className="mb-12 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#302E29] text-lg font-bold text-white">
              F
            </div>
            <span className="text-xl font-bold tracking-tight">
              FormFlow
            </span>
          </Link>

          <p className="mb-4 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#969080]">
            Workspace
          </p>

          <nav className="space-y-1.5">
            {navigation.map((item, index) => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium transition ${
                  index === 0
                    ? "bg-[#302E29] text-white shadow-sm"
                    : "text-[#716C60] hover:bg-[#E8E2D5] hover:text-[#302E29]"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
                {index === 0 && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#D9CBA8]" />
                )}
              </Link>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-[#DED6C1] bg-white/70 p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3F0E7]">
              ✦
            </div>
            <p className="text-sm font-semibold">Need some help?</p>
            <p className="mt-1 text-xs leading-5 text-[#817B6E]">
              Create beautiful forms and collect responses with FormFlow.
            </p>
            <Link
              href="/explore"
              className="mt-3 inline-block text-xs font-semibold text-[#756B52] hover:underline"
            >
              Explore forms →
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-7 lg:px-9">

          {/* Header */}
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#969080]">
                Workspace / Overview
              </p>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-[28px]">
                Dashboard
              </h1>
              <p className="mt-1 text-sm text-[#817B6E]">
                Your workspace at a glance.
              </p>
            </div>

            <div className="flex items-center gap-2.5">

              {/* Notifications */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setIsNotificationsOpen(!isNotificationsOpen)
                  }
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#DED6C1] bg-white text-lg transition hover:bg-[#F3F0E7]"
                  aria-label="Notifications"
                >
                  ♧

                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                {isNotificationsOpen && (
                  <div className="absolute right-0 top-full z-50 mt-3 w-[min(90vw,360px)] overflow-hidden rounded-2xl border border-[#E8E2D5] bg-white shadow-xl">

                    <div className="flex items-center justify-between border-b border-[#E8E2D5] p-4">
                      <div>
                        <h3 className="text-sm font-semibold">
                          Notifications
                        </h3>
                        <p className="mt-1 text-xs text-[#969080]">
                          {unreadCount} unread
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => markAllAsReadMutation.mutate()}
                        disabled={
                          unreadCount === 0 ||
                          markAllAsReadMutation.isPending
                        }
                        className="text-xs font-semibold text-[#756B52] hover:underline disabled:opacity-40"
                      >
                        Mark all as read
                      </button>
                    </div>

                    <div className="max-h-[350px] overflow-y-auto">
                      {!notificationsList ||
                      notificationsList.length === 0 ? (
                        <div className="p-9 text-center">
                          <p className="text-2xl">♧</p>
                          <p className="mt-2 text-sm font-semibold">
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
                              <span className="mt-1 text-xs">
                                {notification.readAt ? "○" : "●"}
                              </span>

                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold">
                                  {notification.title}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-[#716C60]">
                                  {notification.message}
                                </p>
                                <p className="mt-1 text-[11px] text-[#969080]">
                                  {notification.formTitle}
                                </p>
                                <p className="mt-1 text-[10px] text-[#A39D90]">
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
                className="rounded-xl bg-[#302E29] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#49453D] sm:px-5"
              >
                + Create Form
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-[#DED6C1] bg-white px-3 py-2.5 text-xs font-semibold text-[#514D43] transition hover:bg-[#F3F0E7]"
              >
                Logout
              </button>
            </div>
          </header>

          {/* Welcome */}
          <section className="mb-7 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Welcome back, {session.user.name || "there"}!
              </h2>
              <p className="mt-1 text-sm text-[#817B6E]">
                Here's what's happening in your workspace.
              </p>
            </div>
            <p className="text-xs text-[#969080]">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </section>

          {/* Statistics */}
          <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-[#E8E2D5] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-[#817B6E]">
                    {stat.label}
                  </p>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3F0E7] text-lg">
                    {stat.icon}
                  </span>
                </div>
                <p className="mt-4 text-3xl font-bold tracking-tight">
                  {stat.value}
                </p>
                <p className="mt-1 text-[11px] text-[#969080]">
                  {stat.description}
                </p>
              </div>
            ))}
          </section>

          {/* Subscription Usage */}
          <section className="mb-6 rounded-2xl border border-[#E8E2D5] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#969080]">
                  Your Subscription
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <h2 className="text-xl font-bold">{planName} Plan</h2>
                  <span className="rounded-full bg-[#F3F0E7] px-2.5 py-1 text-[10px] font-semibold text-[#756B52]">
                    {subscription?.status ?? "active"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#817B6E]">
                  Your current plan and monthly usage.
                </p>
              </div>

              <Link
                href="/pricing"
                className="rounded-xl border border-[#DED6C1] px-4 py-2.5 text-xs font-semibold text-[#514D43] transition hover:bg-[#F3F0E7]"
              >
                View Plans →
              </Link>
            </div>

            {isSubscriptionLoading ? (
              <div className="mt-6 text-sm text-[#969080]">
                Loading subscription usage...
              </div>
            ) : subscriptionError ? (
              <p className="mt-5 text-sm text-red-600">
                Unable to load subscription details. Please refresh.
              </p>
            ) : subscription ? (
              <div className="mt-6 grid gap-6 md:grid-cols-2">

                {/* Forms Usage */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#514D43]">
                      Forms Created
                    </p>
                    <p className="text-xs font-semibold tabular-nums">
                      {formatNumber(formsUsed)} /{" "}
                      {formLimit === null
                        ? "Unlimited"
                        : formatNumber(formLimit)}
                    </p>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-[#F0EDE4]">
                    <div
                      className="h-full rounded-full bg-[#81765D] transition-all"
                      style={{
                        width:
                          formLimit === null
                            ? "0%"
                            : `${formPercentage}%`,
                      }}
                    />
                  </div>

                  <p className="mt-2 text-[10px] text-[#969080]">
                    Includes archived forms
                  </p>
                </div>

                {/* Response Usage */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#514D43]">
                      Monthly Responses
                    </p>
                    <p className="text-xs font-semibold tabular-nums">
                      {formatNumber(responsesUsed)} /{" "}
                      {formatNumber(responseLimit)}
                    </p>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-[#F0EDE4]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        responsePercentage >= 90
                          ? "bg-red-500"
                          : "bg-[#81765D]"
                      }`}
                      style={{ width: `${responsePercentage}%` }}
                    />
                  </div>

                  <p className="mt-2 text-[10px] text-[#969080]">
                    Resets at the beginning of each month (UTC)
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          {/* Analytics */}
          <section className="mb-6 rounded-2xl border border-[#E8E2D5] bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="text-base font-semibold">
                Responses Over Time
              </h2>
              <p className="mt-1 text-xs text-[#969080]">
                Track how people respond to your forms.
              </p>
            </div>

            {isAnalyticsLoading ? (
              <div className="flex h-56 items-center justify-center text-sm text-[#969080]">
                Loading analytics...
              </div>
            ) : analyticsData && analyticsData.length > 0 ? (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={analyticsData}
                    margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#EAE5D9"
                    />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#969080", fontSize: 11 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#969080", fontSize: 11 }}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="responses"
                      stroke="#81765D"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#81765D" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-52 flex-col items-center justify-center text-center">
                <span className="text-3xl">▥</span>
                <p className="mt-3 text-sm font-semibold">
                  No analytics yet
                </p>
                <p className="mt-1 text-xs text-[#969080]">
                  Responses will appear here once people submit your forms.
                </p>
              </div>
            )}
          </section>

          {/* Recent Forms */}
          <section className="mb-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Recent Forms</h2>
                <p className="mt-1 text-xs text-[#969080]">
                  Your latest forms and their activity.
                </p>
              </div>

              <Link
                href="/dashboard/forms"
                className="text-xs font-semibold text-[#756B52] hover:underline"
              >
                View all forms →
              </Link>
            </div>

            {areFormsLoading ? (
              <div className="rounded-2xl border border-[#E8E2D5] bg-white p-8 text-center text-sm text-[#969080]">
                Loading forms...
              </div>
            ) : formsError ? (
              <div className="rounded-2xl border border-red-200 bg-white p-7 text-center text-sm text-red-600">
                Unable to load your forms. Please refresh the page.
              </div>
            ) : recentForms.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#CFC6B1] bg-white p-10 text-center">
                <span className="text-3xl">▤</span>
                <h3 className="mt-3 text-sm font-semibold">
                  No forms created yet
                </h3>
                <p className="mt-1 text-xs text-[#969080]">
                  Create your first form to start collecting responses.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-4 rounded-xl bg-[#302E29] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#49453D]"
                >
                  Create your first form
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentForms.map((form) => (
                  <div
                    key={form.id}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-[#E8E2D5] bg-white p-4 transition hover:border-[#CFC6B1] sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3F0E7] text-lg">
                        ▤
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold">
                            {form.title}
                          </h3>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                              form.status === "published"
                                ? "bg-green-100 text-green-700"
                                : "bg-[#F0EDE4] text-[#777064]"
                            }`}
                          >
                            {form.status}
                          </span>
                        </div>

                        <p className="mt-1 truncate text-xs text-[#969080]">
                          {form.description || "No description"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                      <Link
                        href={`/dashboard/forms/${form.id}`}
                        className="rounded-lg border border-[#DED6C1] px-3 py-2 text-[11px] font-semibold hover:bg-[#F8F6F0]"
                      >
                        Edit
                      </Link>

                      <Link
                        href={`/dashboard/forms/${form.id}/responses`}
                        className="rounded-lg bg-[#302E29] px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#49453D]"
                      >
                        Responses
                      </Link>

                      <button
                        type="button"
                        onClick={() =>
                          cloneFormMutation.mutate({ formId: form.id })
                        }
                        disabled={cloneFormMutation.isPending}
                        className="rounded-lg border border-[#DED6C1] px-3 py-2 text-[11px] font-semibold hover:bg-[#F8F6F0] disabled:opacity-50"
                      >
                        Clone
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
                        className="rounded-lg border border-[#DED6C1] px-3 py-2 text-[11px] font-semibold hover:bg-[#F8F6F0] disabled:opacity-50"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cloneFormMutation.error && (
              <p className="mt-3 text-xs text-red-600">
                {cloneFormMutation.error.message}
              </p>
            )}
            {archiveFormMutation.error && (
              <p className="mt-3 text-xs text-red-600">
                {archiveFormMutation.error.message}
              </p>
            )}
          </section>

          {/* Archived Forms */}
          <section className="mb-6 rounded-2xl border border-[#E8E2D5] bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Archived Forms</h2>
                <span className="rounded-full bg-[#F3F0E7] px-2 py-0.5 text-[10px] font-semibold text-[#756B52]">
                  {archivedForms.length}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#969080]">
                Restore or permanently delete archived forms.
              </p>
            </div>

            {archivedForms.length === 0 ? (
              <p className="rounded-xl bg-[#F8F6F0] p-5 text-center text-xs text-[#969080]">
                No archived forms yet.
              </p>
            ) : (
              <div className="space-y-2">
                {archivedForms.map((form) => (
                  <div
                    key={form.id}
                    className="flex flex-col justify-between gap-3 rounded-xl bg-[#F8F6F0] p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">
                        {form.title}
                      </h3>
                      <p className="mt-1 text-[11px] text-[#969080]">
                        Archived{" "}
                        {new Date(form.archivedAt!).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          restoreFormMutation.mutate({ formId: form.id })
                        }
                        disabled={restoreFormMutation.isPending}
                        className="rounded-lg bg-[#E8E2D5] px-3 py-2 text-[11px] font-semibold text-[#302E29] hover:bg-[#DED6C1] disabled:opacity-50"
                      >
                        Restore
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
                        className="rounded-lg border border-red-200 px-3 py-2 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {restoreFormMutation.error && (
              <p className="mt-3 text-xs text-red-600">
                {restoreFormMutation.error.message}
              </p>
            )}
            {deleteFormMutation.error && (
              <p className="mt-3 text-xs text-red-600">
                {deleteFormMutation.error.message}
              </p>
            )}
          </section>

          {/* Account Information */}
          <section className="rounded-2xl border border-[#E8E2D5] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Account Information</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#969080]">
                  Name
                </p>
                <p className="mt-1 text-sm font-medium">
                  {profile?.user?.name || session.user.name || "Not available"}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#969080]">
                  Email
                </p>
                <p className="mt-1 text-sm font-medium">
                  {session.user.email}
                </p>
              </div>
            </div>
          </section>

          <footer className="py-7 text-center text-[10px] text-[#969080]">
            © {new Date().getFullYear()} FormFlow. All rights reserved.
          </footer>
        </main>
      </div>

      {/* Create Form Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-[#E8E2D5] bg-white p-6 shadow-2xl sm:p-7">

            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#969080]">
                  Workspace
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  Create a new form
                </h2>
                <p className="mt-1 text-xs text-[#969080]">
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

            <form onSubmit={handleCreateForm} className="space-y-4">
              <div>
                <label
                  htmlFor="form-title"
                  className="mb-2 block text-xs font-semibold"
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
                  maxLength={100}
                  className="w-full rounded-xl border border-[#DED6C1] px-4 py-3 text-sm outline-none transition focus:border-[#81765D] focus:ring-2 focus:ring-[#81765D]/10"
                />
              </div>

              <div>
                <label
                  htmlFor="form-description"
                  className="mb-2 block text-xs font-semibold"
                >
                  Description (optional)
                </label>
                <textarea
                  id="form-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell people what this form is about..."
                  rows={3}
                  maxLength={500}
                  className="w-full resize-none rounded-xl border border-[#DED6C1] px-4 py-3 text-sm outline-none transition focus:border-[#81765D] focus:ring-2 focus:ring-[#81765D]/10"
                />
              </div>

              {createFormMutation.error && (
                <p className="rounded-lg bg-red-50 p-3 text-xs text-red-600">
                  {createFormMutation.error.message}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-[#DED6C1] px-4 py-2.5 text-xs font-semibold hover:bg-[#F8F6F0]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    createFormMutation.isPending || !title.trim()
                  }
                  className="rounded-xl bg-[#302E29] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#49453D] disabled:cursor-not-allowed disabled:opacity-50"
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
