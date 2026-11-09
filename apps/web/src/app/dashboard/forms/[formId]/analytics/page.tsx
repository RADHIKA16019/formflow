"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/utils/trpc";

export default function FormAnalyticsPage() {
  const params = useParams<{ formId: string }>();
  const formId = params.formId;

  const analyticsQuery = trpc.getFormAnalytics.useQuery({ formId });

  if (analyticsQuery.isLoading) {
    return (
      <div className="p-10 text-center text-[#777267]">
        Loading form analytics...
      </div>
    );
  }

  if (analyticsQuery.isError) {
    return (
      <div className="p-10 text-center text-red-600">
        {analyticsQuery.error.message}
      </div>
    );
  }

  const analytics = analyticsQuery.data;
if (!analytics) {
  return (
    <div className="p-10 text-center text-[#777267]">
      No analytics data available.
    </div>
  );
}
  return (
    <main className="min-h-screen bg-[#F8F6F0] px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <a
          href={`/dashboard/forms/${formId}`}
          className="text-sm text-[#777267] hover:text-black"
        >
          ← Back to Form Builder
        </a>

        <div className="mb-8 mt-5">
          <h1 className="text-3xl font-bold text-[#302E29]">
            Form Analytics
          </h1>

          <p className="mt-2 text-sm text-[#777267]">
            {analytics.form.title}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-xl border border-[#DED6C1] bg-white p-6">
            <p className="text-sm text-[#777267]">Total Responses</p>
            <h2 className="mt-2 text-4xl font-bold text-[#302E29]">
              {analytics.totalResponses}
            </h2>
          </div>

          <div className="rounded-xl border border-[#DED6C1] bg-white p-6">
            <p className="text-sm text-[#777267]">Latest Response</p>
            <h2 className="mt-2 text-lg font-bold text-[#302E29]">
              {analytics.latestResponseAt
                ? new Date(analytics.latestResponseAt).toLocaleString()
                : "No responses yet"}
            </h2>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-[#DED6C1] bg-white p-6">
          <h2 className="text-xl font-semibold text-[#302E29]">
            Daily Response Trends
          </h2>

          <p className="mt-1 text-sm text-[#777267]">
            Responses received each day.
          </p>

          {analytics.dailyResponses.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#777267]">
              No response data available yet.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {analytics.dailyResponses.map((item) => {
                const maxResponses = Math.max(
                  ...analytics.dailyResponses.map((entry) => entry.responses)
                );

                const width = Math.max(
                  (item.responses / maxResponses) * 100,
                  3
                );

                return (
                  <div key={item.date}>
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="text-[#777267]">{item.date}</span>
                      <span className="font-semibold text-[#302E29]">
                        {item.responses}
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-[#F0EDE5]">
                      <div
                        className="h-full rounded-full bg-[#9A8664]"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}