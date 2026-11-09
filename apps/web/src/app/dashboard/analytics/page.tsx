
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { trpc } from "../../../utils/trpc";

export default function AnalyticsPage() {
  const formsQuery = trpc.getMyForms.useQuery();
  const analyticsQuery = trpc.getResponseAnalytics.useQuery();

  const forms = formsQuery.data ?? [];
  const analytics = analyticsQuery.data ?? [];

  const publishedForms = forms.filter(
    (form) => form.status === "published"
  ).length;

  const draftForms = forms.filter(
    (form) => form.status === "draft"
  ).length;

  const totalResponses = useMemo(
    () =>
      analytics.reduce(
        (total, item) => total + Number(item.responses),
        0
      ),
    [analytics]
  );

  const maxResponses = Math.max(
    ...analytics.map((item) => Number(item.responses)),
    1
  );

  const isLoading = formsQuery.isLoading || analyticsQuery.isLoading;
  const hasError = formsQuery.isError || analyticsQuery.isError;

  return (
    <main className="min-h-screen bg-[#F8F6F0] px-6 py-8 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-[#A47755]">
              FORM ANALYTICS
            </p>
            <h1 className="text-3xl font-bold text-[#30251F]">
              Analytics Overview
            </h1>
            <p className="mt-2 text-sm text-[#82766D]">
              Track your forms and understand your response activity.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-[#E5D8CA] bg-white px-5 py-3 text-sm font-semibold text-[#594333] transition hover:bg-[#F5EDE4]"
          >
            Back to Dashboard
          </Link>
        </div>

        {hasError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Unable to load analytics. Please refresh the page and try again.
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl border border-[#EDE3D8] bg-white p-10 text-center text-[#82766D]">
            Loading analytics...
          </div>
        ) : (
          <>
            <div className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total Forms",
                  value: forms.length,
                  color: "#E9D8C7",
                  icon: "📝",
                },
                {
                  label: "Published Forms",
                  value: publishedForms,
                  color: "#DDE9D9",
                  icon: "🌿",
                },
                {
                  label: "Draft Forms",
                  value: draftForms,
                  color: "#F4E6C9",
                  icon: "📋",
                },
                {
                  label: "Total Responses",
                  value: totalResponses,
                  color: "#E7DFF0",
                  icon: "📊",
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-[#EDE3D8] bg-white p-6 shadow-sm"
                >
                  <div
                    className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl text-xl"
                    style={{ backgroundColor: card.color }}
                  >
                    {card.icon}
                  </div>
                  <p className="text-sm font-medium text-[#82766D]">
                    {card.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[#30251F]">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>

            <section className="rounded-2xl border border-[#EDE3D8] bg-white p-6 shadow-sm md:p-8">
              <div className="mb-8">
                <h2 className="text-xl font-bold text-[#30251F]">
                  Response Trends
                </h2>
                <p className="mt-1 text-sm text-[#82766D]">
                  Daily response activity across all your forms.
                </p>
              </div>

              {analytics.length === 0 ? (
                <div className="rounded-xl bg-[#FAF8F5] px-5 py-12 text-center">
                  <p className="text-3xl">📈</p>
                  <p className="mt-3 font-semibold text-[#594333]">
                    No responses yet
                  </p>
                  <p className="mt-1 text-sm text-[#82766D]">
                    Your response trends will appear here once people submit
                    your forms.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {analytics.map((item) => {
                    const count = Number(item.responses);
                    const width = (count / maxResponses) * 100;

                    return (
                      <div key={item.date}>
                        <div className="mb-2 flex items-center justify-between gap-4">
                          <span className="text-sm font-medium text-[#594333]">
                            {item.date}
                          </span>
                          <span className="text-sm font-bold text-[#30251F]">
                            {count} responses
                          </span>
                        </div>

                        <div className="h-3 overflow-hidden rounded-full bg-[#F1EBE4]">
                          <div
                            className="h-full rounded-full bg-[#B9825B] transition-all"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="mt-6 flex justify-end">
              <Link
                href="/dashboard/forms"
                className="text-sm font-semibold text-[#A47755] hover:underline"
              >
                Manage My Forms →
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
