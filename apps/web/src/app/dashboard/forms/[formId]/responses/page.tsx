
"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { trpc } from "@/utils/trpc";

type AnalyticsDays = "7" | "30" | "90";

function ResponsesContent() {
  const params = useParams<{ formId: string }>();
  const formId = params.formId;

  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"analytics" | "submissions">(
    "analytics"
  );
  const [selectedDays, setSelectedDays] = useState<AnalyticsDays>("30");

  const responsesQuery = trpc.getFormResponses.useQuery({ formId });
  const questionsQuery = trpc.getQuestionsByForm.useQuery({ formId });

  const analyticsQuery = trpc.getFormAnalytics.useQuery(
    {
      formId,
      days: selectedDays,
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const deleteResponseMutation = trpc.deleteResponse.useMutation({
    onSuccess: async () => {
      await Promise.all([
        responsesQuery.refetch(),
        analyticsQuery.refetch(),
      ]);

      setSelectedResponse(null);
    },
  });

  const responses = responsesQuery.data ?? [];
  const questions = questionsQuery.data ?? [];
  const analytics = analyticsQuery.data;

  const formatDate = (date: string | Date) =>
    new Date(date).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const handleDeleteResponse = (responseId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this response? This action cannot be undone."
    );

    if (confirmed) {
      deleteResponseMutation.mutate({ responseId });
    }
  };

  // Search and date filtering
  const filteredResponses = responses.filter((response) => {
    const answers = response.answers as Record<string, unknown>;

    const searchableText = [
      response.respondentEmail ?? "",
      ...Object.values(answers).map((answer) =>
        Array.isArray(answer)
          ? answer.join(" ")
          : typeof answer === "object" && answer !== null
            ? JSON.stringify(answer)
            : String(answer ?? "")
      ),
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = searchableText.includes(
      searchTerm.toLowerCase().trim()
    );

    const submittedDate = new Date(response.submittedAt);

    const localDate = [
      submittedDate.getFullYear(),
      String(submittedDate.getMonth() + 1).padStart(2, "0"),
      String(submittedDate.getDate()).padStart(2, "0"),
    ].join("-");

    const matchesDate = !dateFilter || localDate === dateFilter;

    return matchesSearch && matchesDate;
  });

  // CSV export
  const handleExportCSV = () => {
    if (filteredResponses.length === 0) return;

    const escapeCSV = (value: unknown) => {
      const text = Array.isArray(value)
        ? value.join(", ")
        : typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : String(value ?? "");

      return `"${text.replace(/"/g, '""')}"`;
    };

    const headers = [
      "Respondent Email",
      "Submitted At",
      ...questions.map((question) => question.title),
    ];

    const rows = filteredResponses.map((response) => {
      const answers = response.answers as Record<string, unknown>;

      return [
        response.respondentEmail || "Anonymous",
        new Date(response.submittedAt).toLocaleString(),
        ...questions.map((question) => answers[question.id] ?? ""),
      ];
    });

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "form-responses.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const chartData = (analytics?.dailyResponses ?? []).map((item) => ({
    date: item.date,
    responses: Number(item.responses),
    label: new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    }),
  }));

  const maxDailyResponses = Math.max(
    0,
    ...chartData.map((item) => item.responses)
  );

  const totalPeriodResponses = chartData.reduce(
    (total, item) => total + item.responses,
    0
  );

  if (responsesQuery.isLoading || questionsQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#F8F6F0]">
        <p className="text-sm text-[#777267]">Loading form responses...</p>
      </div>
    );
  }

  if (responsesQuery.isError || questionsQuery.isError) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] p-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-8">
          <h2 className="font-semibold text-red-600">
            Unable to load responses
          </h2>
          <p className="mt-2 text-sm text-[#777267]">
            {responsesQuery.error?.message ||
              questionsQuery.error?.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F6F0] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/dashboard/forms/${formId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#777267] transition hover:text-black"
          >
            ← Back to Form Builder
          </Link>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9A8664]">
                Form Management
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#302E29] sm:text-4xl">
                Form Responses
              </h1>

              <p className="mt-2 text-sm text-[#777267]">
                Understand your audience and manage every submission.
              </p>
            </div>

            <div className="rounded-xl border border-[#DED6C1] bg-white px-5 py-3">
              <p className="text-xs text-[#777267]">Total submissions</p>
              <p className="mt-1 text-2xl font-bold text-[#302E29]">
                {responses.length}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex gap-6 border-b border-[#DED6C1]">
          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            className={`relative pb-4 text-sm font-semibold transition ${
              activeTab === "analytics"
                ? "text-[#302E29]"
                : "text-[#898477] hover:text-[#302E29]"
            }`}
          >
            Detailed Analytics
            {activeTab === "analytics" && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#9A8664]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("submissions")}
            className={`relative pb-4 text-sm font-semibold transition ${
              activeTab === "submissions"
                ? "text-[#302E29]"
                : "text-[#898477] hover:text-[#302E29]"
            }`}
          >
            All Submissions
            {activeTab === "submissions" && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#9A8664]" />
            )}
          </button>
        </div>

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#302E29]">
                  Detailed Analytics
                </h2>
                <p className="mt-1 text-sm text-[#898477]">
                  Monitor your form performance and response activity.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={filteredResponses.length === 0}
                className="rounded-xl bg-[#302E29] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#49453D] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ↓ Export CSV ({filteredResponses.length})
              </button>
            </div>

            {analyticsQuery.isLoading && (
              <div className="rounded-2xl border border-[#DED6C1] bg-white p-12 text-center">
                <p className="text-sm text-[#777267]">
                  Loading detailed analytics...
                </p>
              </div>
            )}

            {analyticsQuery.isError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-600">
                {analyticsQuery.error.message}
              </div>
            )}

            {analytics && (
              <>
                {/* Summary Cards */}
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-2xl border border-[#DED6C1] bg-white p-6">
                    <p className="text-sm font-medium text-[#777267]">
                      Total Responses
                    </p>

                    <h2 className="mt-4 text-4xl font-bold text-[#302E29]">
                      {analytics.totalResponses}
                    </h2>

                    <p className="mt-2 text-xs text-[#898477]">
                      All-time submissions
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#DED6C1] bg-white p-6">
                    <p className="text-sm font-medium text-[#777267]">
                      Latest Response
                    </p>

                    <h2 className="mt-4 text-xl font-bold text-[#302E29]">
                      {analytics.latestResponseAt
                        ? formatDate(analytics.latestResponseAt)
                        : "No responses yet"}
                    </h2>

                    <p className="mt-2 text-xs text-[#898477]">
                      Most recent submission
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#DED6C1] bg-white p-6">
                    <p className="text-sm font-medium text-[#777267]">
                      Form Status
                    </p>

                    <div className="mt-4">
                      <span
                        className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold capitalize ${
                          analytics.form.status === "published"
                            ? "bg-green-50 text-green-700"
                            : "bg-[#F0EDE5] text-[#777267]"
                        }`}
                      >
                        {analytics.form.status}
                      </span>
                    </div>

                    <p className="mt-3 text-xs text-[#898477]">
                      Current form status
                    </p>
                  </div>
                </div>

                {/* Response Chart */}
                <section className="overflow-hidden rounded-2xl border border-[#DED6C1] bg-white p-5 sm:p-7">
                  <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                    <div>
                      <h2 className="text-xl font-bold text-[#302E29]">
                        Response Trends
                      </h2>

                      <p className="mt-1 text-sm text-[#898477]">
                        Track how many responses your form receives over time.
                      </p>
                    </div>

                    <div className="flex w-fit flex-wrap rounded-xl bg-[#F5F2EA] p-1">
                      {(["7", "30", "90"] as const).map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setSelectedDays(days)}
                          disabled={analyticsQuery.isFetching}
                          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                            selectedDays === days
                              ? "bg-[#302E29] text-white shadow-sm"
                              : "text-[#777267] hover:text-[#302E29]"
                          } disabled:cursor-wait`}
                        >
                          {days} Days
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-[#898477]">
                        Responses in selected period
                      </p>

                      <p className="mt-1 text-3xl font-bold text-[#302E29]">
                        {totalPeriodResponses}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[#777267]">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#9A8664]" />
                      Daily responses
                    </div>
                  </div>

                  {analyticsQuery.isFetching && (
                    <p className="mt-4 text-xs text-[#9A8664]">
                      Updating chart...
                    </p>
                  )}

                  {chartData.length === 0 ? (
                    <div className="mt-8 flex min-h-[280px] flex-col items-center justify-center rounded-xl bg-[#FAF9F5] px-5 text-center">
                      <span className="text-4xl text-[#B8AA8F]">▥</span>

                      <h3 className="mt-4 font-semibold text-[#302E29]">
                        No response activity yet
                      </h3>

                      <p className="mt-2 max-w-sm text-sm text-[#898477]">
                        Responses received during the selected period will
                        appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-8 h-[300px] w-full sm:h-[360px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={chartData}
                          margin={{
                            top: 10,
                            right: 12,
                            left: -18,
                            bottom: 0,
                          }}
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
                                stopColor="#9A8664"
                                stopOpacity={0.32}
                              />
                              <stop
                                offset="95%"
                                stopColor="#9A8664"
                                stopOpacity={0.02}
                              />
                            </linearGradient>
                          </defs>

                          <CartesianGrid
                            stroke="#EEEAE0"
                            strokeDasharray="4 4"
                            vertical={false}
                          />

                          <XAxis
                            dataKey="label"
                            tick={{ fill: "#898477", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={25}
                          />

                          <YAxis
                            allowDecimals={false}
                            domain={[0, Math.max(1, maxDailyResponses)]}
                            tick={{ fill: "#898477", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={35}
                          />

                          <Tooltip
                            contentStyle={{
                              borderRadius: "12px",
                              border: "1px solid #DED6C1",
                              backgroundColor: "#FFFFFF",
                              boxShadow: "0 5px 20px rgba(0,0,0,0.06)",
                              fontSize: "12px",
                            }}
                            labelStyle={{
                              color: "#302E29",
                              fontWeight: 600,
                            }}
                            formatter={(value) => [
                              `${value ?? 0} responses`,
                              "Submissions",
                            ]}
                            labelFormatter={(_, payload) =>
                              payload?.[0]?.payload?.date ?? ""
                            }
                          />

                          <Area
                            type="basis"
                            dataKey="responses"
                            stroke="#9A8664"
                            strokeWidth={3}
                            fill="url(#responseGradient)"
                            activeDot={{
                              r: 6,
                              stroke: "#FFFFFF",
                              strokeWidth: 2,
                              fill: "#9A8664",
                            }}
                            dot={false}
                            animationDuration={900}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </section>

                {/* Daily Breakdown */}
                <section className="rounded-2xl border border-[#DED6C1] bg-white p-6">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-[#302E29]">
                        Daily Breakdown
                      </h2>

                      <p className="mt-1 text-sm text-[#898477]">
                        Individual response counts for each recorded day.
                      </p>
                    </div>

                    <span className="rounded-full bg-[#F5F2EA] px-3 py-1.5 text-xs font-semibold text-[#777267]">
                      Last {selectedDays} days
                    </span>
                  </div>

                  {chartData.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[#898477]">
                      No daily breakdown available.
                    </p>
                  ) : (
                    <div className="space-y-5">
                      {[...chartData].reverse().map((item) => (
                        <div key={item.date}>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-sm text-[#777267]">
                              {item.date}
                            </span>

                            <span className="text-sm font-semibold text-[#302E29]">
                              {item.responses}{" "}
                              {item.responses === 1 ? "response" : "responses"}
                            </span>
                          </div>

                          <div className="h-2.5 overflow-hidden rounded-full bg-[#F0EDE5]">
                            <div
                              className="h-full rounded-full bg-[#9A8664] transition-all duration-500"
                              style={{
                                width: `${
                                  maxDailyResponses > 0
                                    ? (item.responses / maxDailyResponses) * 100
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        )}

        {/* All Submissions Tab */}
        {activeTab === "submissions" && (
          <div>
            <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#302E29]">
                  All Submissions
                </h2>

                <p className="mt-1 text-sm text-[#898477]">
                  Browse, search, export and manage form responses.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={filteredResponses.length === 0}
                className="rounded-xl bg-[#302E29] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#49453D] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ↓ Export CSV ({filteredResponses.length})
              </button>
            </div>

            {/* Submission Stats */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[#DED6C1] bg-white p-5">
                <p className="text-xs text-[#898477]">Total submissions</p>

                <p className="mt-2 text-3xl font-bold text-[#302E29]">
                  {responses.length}
                </p>
              </div>

              <div className="rounded-xl border border-[#DED6C1] bg-white p-5">
                <p className="text-xs text-[#898477]">Filtered submissions</p>

                <p className="mt-2 text-3xl font-bold text-[#302E29]">
                  {filteredResponses.length}
                </p>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="mb-5 rounded-2xl border border-[#DED6C1] bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  type="text"
                  placeholder="Search email or answers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full flex-1 rounded-xl border border-[#DED6C1] bg-[#FAF9F5] px-4 py-3 text-sm text-[#302E29] outline-none transition placeholder:text-[#AAA394] focus:border-[#9A8664]"
                />

                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="rounded-xl border border-[#DED6C1] bg-[#FAF9F5] px-4 py-3 text-sm text-[#777267] outline-none focus:border-[#9A8664]"
                />

                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setDateFilter("");
                  }}
                  className="rounded-xl border border-[#DED6C1] px-5 py-3 text-sm font-semibold text-[#777267] transition hover:bg-[#F8F6F0]"
                >
                  Clear Filters
                </button>
              </div>

              <p className="mt-3 text-xs text-[#898477]">
                Showing {filteredResponses.length} of {responses.length}{" "}
                submissions
              </p>
            </div>

            {/* Delete Error */}
            {deleteResponseMutation.isError && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                Failed to delete response:{" "}
                {deleteResponseMutation.error.message}
              </div>
            )}

            {/* Response List */}
            {filteredResponses.length === 0 ? (
              <div className="rounded-2xl border border-[#DED6C1] bg-white px-6 py-16 text-center">
                <div className="text-4xl text-[#B8AA8F]">▤</div>

                <h3 className="mt-4 text-lg font-bold text-[#302E29]">
                  {responses.length === 0
                    ? "No submissions yet"
                    : "No matching submissions"}
                </h3>

                <p className="mx-auto mt-2 max-w-sm text-sm text-[#898477]">
                  {responses.length === 0
                    ? "When someone submits your form, their response will appear here."
                    : "Try changing your search term or clearing the date filter."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredResponses.map((response, index) => {
                  const answers = response.answers as Record<string, unknown>;
                  const isSelected = selectedResponse === response.id;

                  return (
                    <div
                      key={response.id}
                      className="overflow-hidden rounded-2xl border border-[#DED6C1] bg-white transition hover:border-[#C9BFA9]"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedResponse(
                            isSelected ? null : response.id
                          )
                        }
                        className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-[#FAF9F5] sm:p-6"
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F0EDE5] text-sm font-bold text-[#9A8664]">
                            {index + 1}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#302E29]">
                              {response.respondentEmail ||
                                "Anonymous respondent"}
                            </p>

                            <p className="mt-1 text-xs text-[#898477]">
                              {formatDate(response.submittedAt)}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 rounded-lg bg-[#F5F2EA] px-3 py-2 text-xs font-semibold text-[#777267]">
                          {isSelected ? "Hide −" : "View +"}
                        </span>
                      </button>

                      {isSelected && (
                        <div className="border-t border-[#EAE5D9] bg-[#FCFBF8] p-5 sm:p-6">
                          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="font-bold text-[#302E29]">
                                Response Details
                              </h3>

                              <p className="mt-1 text-xs text-[#898477]">
                                Submitted on {formatDate(response.submittedAt)}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteResponse(response.id)
                              }
                              disabled={deleteResponseMutation.isPending}
                              className="rounded-xl border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deleteResponseMutation.isPending
                                ? "Deleting..."
                                : "Delete Response"}
                            </button>
                          </div>

                          {Object.entries(answers).length === 0 ? (
                            <p className="text-sm text-[#898477]">
                              No answer details available.
                            </p>
                          ) : (
                            <div className="space-y-4">
                              {Object.entries(answers).map(
                                ([questionId, answer]) => {
                                  const question = questions.find(
                                    (q) => q.id === questionId
                                  );

                                  return (
                                    <div
                                      key={questionId}
                                      className="rounded-xl border border-[#EAE5D9] bg-white p-5"
                                    >
                                      <p className="text-sm font-semibold text-[#302E29]">
                                        {question?.title || "Question"}
                                      </p>

                                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#777267]">
                                        {Array.isArray(answer)
                                          ? answer.join(", ")
                                          : typeof answer === "object" &&
                                              answer !== null
                                            ? JSON.stringify(answer, null, 2)
                                            : String(answer ?? "No answer")}
                                      </p>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function ResponsesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F8F6F0]">
          <p className="text-sm text-[#777267]">Loading responses...</p>
        </div>
      }
    >
      <ResponsesContent />
    </Suspense>
  );
}
