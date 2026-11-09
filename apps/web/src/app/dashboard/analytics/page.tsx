
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "../../../utils/trpc";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function AnalyticsPage() {
  const [selectedDays, setSelectedDays] = useState<"7" | "30" | "90">("30");

const formsQuery = trpc.getMyForms.useQuery();

const analyticsQuery = trpc.getResponseAnalytics.useQuery({
  days: selectedDays,
});
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
             <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
  <div>
    <h2 className="text-xl font-bold text-[#30251F]">
      Response Trends
    </h2>
    <p className="mt-1 text-sm text-[#82766D]">
      Daily response activity across all your forms.
    </p>
  </div>

  <div className="flex rounded-xl border border-[#EDE3D8] bg-[#FAF8F5] p-1">
    {(["7", "30", "90"] as const).map((days) => (
      <button
        key={days}
        onClick={() => setSelectedDays(days)}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
          selectedDays === days
            ? "bg-[#A47755] text-white shadow-sm"
            : "text-[#82766D] hover:text-[#30251F]"
        }`}
      >
        {days} Days
      </button>
    ))}
  </div>
</div>

              {analyticsQuery.isFetching ? (
  <div className="rounded-xl bg-[#FAF8F5] px-5 py-12 text-center">
    <p className="text-sm font-medium text-[#82766D]">
      Updating response trends...
    </p>
  </div>
) : analytics.length === 0 ?  (
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
  <div className="h-[320px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={analytics}
        margin={{ top: 10, right: 15, left: -20, bottom: 5 }}
      >
        <defs>
          <linearGradient
            id="responseGradient"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#B9825B"
              stopOpacity={0.35}
            />
            <stop
              offset="95%"
              stopColor="#B9825B"
              stopOpacity={0.02}
            />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="#EDE3D8"
        />

        <XAxis
          dataKey="date"
          tickFormatter={(value) =>
            new Date(`${value}T00:00:00`).toLocaleDateString(
              "en-IN",
              { day: "2-digit", month: "short" }
            )
          }
          tick={{ fill: "#82766D", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />

        <YAxis
          allowDecimals={false}
          tick={{ fill: "#82766D", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />

        <Tooltip
          labelFormatter={(value) =>
            new Date(`${value}T00:00:00`).toLocaleDateString(
              "en-IN",
              {
                day: "numeric",
                month: "long",
                year: "numeric",
              }
            )
          }
          formatter={(value) => [
            `${value} responses`,
            "Responses",
          ]}
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid #EDE3D8",
            backgroundColor: "#FFFFFF",
          }}
        />

        <Area
          type="monotone"
          dataKey="responses"
          stroke="#B9825B"
          strokeWidth={3}
          fill="url(#responseGradient)"
          activeDot={{
            r: 6,
            fill: "#A47755",
            stroke: "#FFFFFF",
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
)
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
