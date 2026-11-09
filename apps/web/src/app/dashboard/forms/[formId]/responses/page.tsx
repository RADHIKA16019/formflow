
"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { trpc } from "@/utils/trpc";

type AnalyticsDays = "7" | "30" | "90";

const chartColors = [
  "#796548",
  "#9A8664",
  "#B8AA8F",
  "#C9BFA9",
  "#D9CFBC",
  "#A18B70",
  "#87765F",
  "#B5A184",
  "#6E604E",
  "#D1BE9D",
];

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
  const [expandedDateQuestion, setExpandedDateQuestion] = useState<
    string | null
  >(null);
  const [expandedTextQuestion, setExpandedTextQuestion] = useState<
    string | null
  >(null);

  const responsesQuery = trpc.getFormResponses.useQuery({ formId });
  const questionsQuery = trpc.getQuestionsByForm.useQuery({ formId });

  const analyticsQuery = trpc.getFormAnalytics.useQuery(
    { formId, days: selectedDays },
    { refetchOnWindowFocus: false }
  );

  const questionAnalyticsQuery = trpc.getQuestionWiseAnalytics.useQuery(
    { formId, days: selectedDays },
    { refetchOnWindowFocus: false }
  );

  const deleteResponseMutation = trpc.deleteResponse.useMutation({
    onSuccess: async () => {
      await Promise.all([
        responsesQuery.refetch(),
        analyticsQuery.refetch(),
        questionAnalyticsQuery.refetch(),
      ]);

      setSelectedResponse(null);
    },
  });

  const responses = responsesQuery.data ?? [];
  const questions = questionsQuery.data ?? [];
  const analytics = analyticsQuery.data;
  const questionAnalytics = questionAnalyticsQuery.data;

  const formatDate = (date: string | Date) => {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Unknown date";
    }

    return parsedDate.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Preserve YYYY-MM-DD dates without timezone shifting.
  const getDateKey = (value: string) => {
    const trimmed = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const parsed = new Date(`${trimmed}T00:00:00`);

      if (!Number.isNaN(parsed.getTime())) {
        return trimmed;
      }

      return null;
    }

    const parsed = new Date(trimmed);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return [
      parsed.getFullYear(),
      String(parsed.getMonth() + 1).padStart(2, "0"),
      String(parsed.getDate()).padStart(2, "0"),
    ].join("-");
  };

  const formatDateLabel = (date: string) => {
    const parsed = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

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

  const ratingColors = [
    "#C9BFA9",
    "#B8AA8F",
    "#A99A7C",
    "#9A8664",
    "#796548",
  ];

  if (responsesQuery.isLoading || questionsQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#F8F6F0]">
        <p className="text-sm text-[#777267]">Loading form responses...</p>
      </div>
    );
  }

  if (responsesQuery.isError || questionsQuery.isError) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] p-5 sm:p-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-8">
          <h2 className="font-semibold text-red-600">
            Unable to load responses
          </h2>
          <p className="mt-2 text-sm text-[#777267]">
            {responsesQuery.error?.message ||
              questionsQuery.error?.message ||
              "Something went wrong."}
          </p>
          <button
            type="button"
            onClick={() => {
              responsesQuery.refetch();
              questionsQuery.refetch();
            }}
            className="mt-5 rounded-xl bg-[#302E29] px-5 py-3 text-sm font-semibold text-white"
          >
            Try Again
          </button>
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
        <div className="mb-8 flex gap-6 overflow-x-auto border-b border-[#DED6C1]">
          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            className={`relative shrink-0 pb-4 text-sm font-semibold transition ${
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
            className={`relative shrink-0 pb-4 text-sm font-semibold transition ${
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
                <p>{analyticsQuery.error.message}</p>
                <button
                  type="button"
                  onClick={() => analyticsQuery.refetch()}
                  className="mt-3 font-semibold underline"
                >
                  Retry analytics
                </button>
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

                {/* Response Trends */}
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

            {/* Question-wise Analytics */}
            <section className="space-y-6">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9A8664]">
                      Advanced Analytics
                    </p>
                    <h2 className="mt-2 text-xl font-bold text-[#302E29]">
                      Question-wise Analysis
                    </h2>
                    <p className="mt-1 text-sm text-[#898477]">
                      Understand how respondents answered each question.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#F0EDE5] px-3 py-2 text-xs font-semibold text-[#777267]">
                    Last {selectedDays} days
                  </span>
                </div>
              </div>

              {questionAnalyticsQuery.isLoading && (
                <div className="rounded-2xl border border-[#DED6C1] bg-white p-12 text-center">
                  <p className="text-sm text-[#777267]">
                    Loading question-wise analytics...
                  </p>
                </div>
              )}

              {questionAnalyticsQuery.isError && (
                <div className="rounded-2xl border border-red-200 bg-white p-6">
                  <h3 className="font-semibold text-red-600">
                    Unable to load question analytics
                  </h3>
                  <p className="mt-2 break-words text-sm text-[#777267]">
                    {questionAnalyticsQuery.error.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => questionAnalyticsQuery.refetch()}
                    className="mt-4 rounded-lg bg-[#302E29] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Try Again
                  </button>
                  <p className="mt-3 text-xs text-[#898477]">
                    Your submissions and other analytics are still available.
                  </p>
                </div>
              )}

              {questionAnalytics && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[#DED6C1] bg-white p-5">
                      <p className="text-sm text-[#777267]">
                        Responses in selected period
                      </p>
                      <p className="mt-2 text-3xl font-bold text-[#302E29]">
                        {questionAnalytics.totalResponses}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#DED6C1] bg-white p-5">
                      <p className="text-sm text-[#777267]">
                        Questions analyzed
                      </p>
                      <p className="mt-2 text-3xl font-bold text-[#302E29]">
                        {questionAnalytics.questions.length}
                      </p>
                    </div>
                  </div>

                  {questionAnalytics.questions.length === 0 ? (
                    <div className="rounded-2xl border border-[#DED6C1] bg-white px-6 py-14 text-center">
                      <p className="text-lg font-bold text-[#302E29]">
                        No questions found
                      </p>
                      <p className="mt-2 text-sm text-[#898477]">
                        Add questions to your form to see question-wise
                        analytics.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {questionAnalytics.questions.map((question, index) => {
                        const hasAnswers = question.totalAnswers > 0;

                        // Date answers are grouped by their actual calendar date.
                        const dateAnswerGroups =
                          question.type === "date"
                            ? question.textAnswers.reduce<
                                Record<string, number>
                              >((groups, answer) => {
                                const dateKey = getDateKey(answer.value);

                                if (dateKey) {
                                  groups[dateKey] =
                                    (groups[dateKey] ?? 0) + 1;
                                }

                                return groups;
                              }, {})
                            : {};

                        const dateChartData = Object.entries(
                          dateAnswerGroups
                        )
                          .map(([date, count]) => ({
                            date,
                            label: formatDateLabel(date),
                            responses: count,
                          }))
                          .sort((a, b) => a.date.localeCompare(b.date));

                        const validDateAnswers =
                          question.type === "date"
                            ? question.textAnswers.filter((answer) =>
                                Boolean(getDateKey(answer.value))
                              )
                            : [];

                        const visibleDateAnswers =
                          expandedDateQuestion === question.id
                            ? validDateAnswers
                            : validDateAnswers.slice(0, 10);

                        const isChoiceQuestion =
                          question.type === "select" ||
                          question.type === "checkbox";

                        const totalOptionSelections =
                          question.optionCounts.reduce(
                            (sum, option) => sum + option.responses,
                            0
                          );

                        const pieData = question.optionCounts
                          .filter((option) => option.responses > 0)
                          .map((option) => ({
                            option: option.option,
                            responses: option.responses,
                          }));

                        const numberChartData =
                          question.type === "number"
                            ? [
                                {
                                  metric: "Minimum",
                                  value:
                                    question.numberStats.minimum !== null
                                      ? Number(question.numberStats.minimum)
                                      : null,
                                },
                                {
                                  metric: "Average",
                                  value:
                                    question.numberStats.average !== null
                                      ? Number(question.numberStats.average)
                                      : null,
                                },
                                {
                                  metric: "Maximum",
                                  value:
                                    question.numberStats.maximum !== null
                                      ? Number(question.numberStats.maximum)
                                      : null,
                                },
                              ].filter(
                                (item) =>
                                  item.value !== null &&
                                  Number.isFinite(item.value)
                              )
                            : [];

                        return (
                          <article
                            key={question.id}
                            className="overflow-hidden rounded-2xl border border-[#DED6C1] bg-white"
                          >
                            <div className="border-b border-[#EEEAE0] p-5 sm:p-6">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-[#9A8664]">
                                    Question {index + 1} · {question.type}
                                  </p>
                                  <h3 className="mt-2 break-words text-lg font-bold text-[#302E29]">
                                    {question.title}
                                  </h3>
                                </div>
                                <div className="shrink-0 rounded-xl bg-[#F5F2EA] px-4 py-3 text-right">
                                  <p className="text-xs text-[#898477]">
                                    Answered
                                  </p>
                                  <p className="mt-1 text-2xl font-bold text-[#302E29]">
                                    {question.totalAnswers}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="p-5 sm:p-6">
                              {!hasAnswers ? (
                                <div className="rounded-xl bg-[#FAF9F5] px-5 py-10 text-center">
                                  <p className="font-semibold text-[#302E29]">
                                    No answers yet
                                  </p>
                                  <p className="mt-2 text-sm text-[#898477]">
                                    Answers to this question will appear here
                                    once respondents submit your form.
                                  </p>
                                </div>
                              ) : isChoiceQuestion ? (
                                /* Select and Checkbox Donut Charts */
                                <div>
                                  <div className="mb-5">
                                    <h4 className="font-semibold text-[#302E29]">
                                      {question.type === "checkbox"
                                        ? "Option Selection Distribution"
                                        : "Response Distribution"}
                                    </h4>
                                    <p className="mt-1 text-xs text-[#898477]">
                                      {question.type === "checkbox"
                                        ? "Each selected option is counted separately. Percentages are based on all selections."
                                        : "Percentage of respondents choosing each option."}
                                    </p>
                                  </div>

                                  {pieData.length === 0 ? (
                                    <p className="rounded-xl bg-[#FAF9F5] p-6 text-center text-sm text-[#898477]">
                                      No option selections available yet.
                                    </p>
                                  ) : (
                                    <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                      <div className="relative mx-auto h-[280px] w-full max-w-[360px]">
                                        <ResponsiveContainer
                                          width="100%"
                                          height="100%"
                                        >
                                          <PieChart>
                                            <Pie
                                              data={pieData}
                                              dataKey="responses"
                                              nameKey="option"
                                              cx="50%"
                                              cy="50%"
                                              innerRadius={76}
                                              outerRadius={112}
                                              paddingAngle={3}
                                              stroke="none"
                                              animationDuration={800}
                                            >
                                              {pieData.map((item, pieIndex) => (
                                                <Cell
                                                  key={item.option}
                                                  fill={
                                                    chartColors[
                                                      pieIndex %
                                                        chartColors.length
                                                    ]
                                                  }
                                                />
                                              ))}
                                            </Pie>
                                            <Tooltip
                                              formatter={(value, name) => [
                                                `${value ?? 0} ${
                                                  question.type === "checkbox"
                                                    ? "selections"
                                                    : "responses"
                                                }`,
                                                name,
                                              ]}
                                              contentStyle={{
                                                borderRadius: "12px",
                                                border: "1px solid #DED6C1",
                                                fontSize: "12px",
                                              }}
                                            />
                                          </PieChart>
                                        </ResponsiveContainer>

                                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                          <span className="text-3xl font-bold text-[#302E29]">
                                            {question.type === "checkbox"
                                              ? totalOptionSelections
                                              : question.totalAnswers}
                                          </span>
                                          <span className="mt-1 text-xs text-[#898477]">
                                            {question.type === "checkbox"
                                              ? "Selections"
                                              : "Responses"}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="space-y-3">
                                        {question.optionCounts.map(
                                          (option, optionIndex) => {
                                            const denominator =
                                              question.type === "checkbox"
                                                ? totalOptionSelections
                                                : question.totalAnswers;

                                            const percentage =
                                              denominator > 0
                                                ? (option.responses /
                                                    denominator) *
                                                  100
                                                : 0;

                                            return (
                                              <div
                                                key={option.option}
                                                className="flex items-center justify-between gap-3 rounded-xl bg-[#FAF9F5] px-4 py-3"
                                              >
                                                <div className="flex min-w-0 items-center gap-3">
                                                  <span
                                                    className="h-3 w-3 shrink-0 rounded-full"
                                                    style={{
                                                      backgroundColor:
                                                        chartColors[
                                                          optionIndex %
                                                            chartColors.length
                                                        ],
                                                    }}
                                                  />
                                                  <span className="break-words text-sm font-medium text-[#302E29]">
                                                    {option.option}
                                                  </span>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                  <p className="text-sm font-bold text-[#302E29]">
                                                    {option.responses}
                                                  </p>
                                                  <p className="text-xs text-[#898477]">
                                                    {percentage.toFixed(1)}%
                                                  </p>
                                                </div>
                                              </div>
                                            );
                                          }
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : question.type === "rating" ? (
                                /* Rating Chart */
                                <div className="space-y-6">
                                  <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-xl bg-[#FAF9F5] p-5">
                                      <p className="text-sm text-[#898477]">
                                        Average Rating
                                      </p>
                                      <div className="mt-2 flex items-baseline gap-2">
                                        <span className="text-4xl font-bold text-[#302E29]">
                                          {question.averageRating?.toFixed(2) ??
                                            "—"}
                                        </span>
                                        <span className="text-lg text-[#9A8664]">
                                          / 5 ★
                                        </span>
                                      </div>
                                      <p className="mt-2 text-xs text-[#898477]">
                                        Based on valid ratings only
                                      </p>
                                    </div>

                                    <div className="rounded-xl bg-[#FAF9F5] p-5">
                                      <p className="text-sm text-[#898477]">
                                        Valid Ratings
                                      </p>
                                      <p className="mt-2 text-4xl font-bold text-[#302E29]">
                                        {question.ratingDistribution.reduce(
                                          (sum, item) => sum + item.responses,
                                          0
                                        )}
                                      </p>
                                      <p className="mt-2 text-xs text-[#898477]">
                                        Out of {question.totalAnswers} answered
                                        submissions
                                      </p>
                                    </div>
                                  </div>

                                  <div>
                                    <h4 className="mb-4 font-semibold text-[#302E29]">
                                      Rating Distribution
                                    </h4>
                                    <div className="h-[260px] w-full">
                                      <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                      >
                                        <BarChart
                                          data={question.ratingDistribution}
                                          margin={{
                                            top: 10,
                                            right: 10,
                                            left: -20,
                                            bottom: 0,
                                          }}
                                        >
                                          <CartesianGrid
                                            stroke="#EEEAE0"
                                            strokeDasharray="4 4"
                                            vertical={false}
                                          />
                                          <XAxis
                                            dataKey="rating"
                                            tickFormatter={(value) =>
                                              `${value} ★`
                                            }
                                            tick={{
                                              fill: "#898477",
                                              fontSize: 12,
                                            }}
                                            axisLine={false}
                                            tickLine={false}
                                          />
                                          <YAxis
                                            allowDecimals={false}
                                            tick={{
                                              fill: "#898477",
                                              fontSize: 11,
                                            }}
                                            axisLine={false}
                                            tickLine={false}
                                          />
                                          <Tooltip
                                            formatter={(value) => [
                                              `${value ?? 0} responses`,
                                              "Ratings",
                                            ]}
                                            labelFormatter={(value) =>
                                              `${value} out of 5 stars`
                                            }
                                            contentStyle={{
                                              borderRadius: "12px",
                                              border: "1px solid #DED6C1",
                                              fontSize: "12px",
                                            }}
                                          />
                                          <Bar
                                            dataKey="responses"
                                            radius={[6, 6, 0, 0]}
                                          >
                                            {question.ratingDistribution.map(
                                              (item, ratingIndex) => (
                                                <Cell
                                                  key={item.rating}
                                                  fill={
                                                    ratingColors[ratingIndex]
                                                  }
                                                />
                                              )
                                            )}
                                          </Bar>
                                        </BarChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </div>
                                </div>
                              ) : question.type === "number" ? (
                                /* Number Summary and Column Chart */
                                <div>
                                  <h4 className="mb-4 font-semibold text-[#302E29]">
                                    Numerical Summary
                                  </h4>

                                  <div className="grid gap-4 sm:grid-cols-3">
                                    <div className="rounded-xl bg-[#FAF9F5] p-5">
                                      <p className="text-xs text-[#898477]">
                                        Minimum
                                      </p>
                                      <p className="mt-2 break-all text-2xl font-bold text-[#302E29]">
                                        {question.numberStats.minimum ?? "—"}
                                      </p>
                                    </div>
                                    <div className="rounded-xl bg-[#FAF9F5] p-5">
                                      <p className="text-xs text-[#898477]">
                                        Average
                                      </p>
                                      <p className="mt-2 break-all text-2xl font-bold text-[#302E29]">
                                        {question.numberStats.average ?? "—"}
                                      </p>
                                    </div>
                                    <div className="rounded-xl bg-[#FAF9F5] p-5">
                                      <p className="text-xs text-[#898477]">
                                        Maximum
                                      </p>
                                      <p className="mt-2 break-all text-2xl font-bold text-[#302E29]">
                                        {question.numberStats.maximum ?? "—"}
                                      </p>
                                    </div>
                                  </div>

                                  {numberChartData.length > 0 && (
                                    <div className="mt-7">
                                      <h4 className="mb-3 font-semibold text-[#302E29]">
                                        Numerical Overview
                                      </h4>
                                      <div className="h-[250px] w-full">
                                        <ResponsiveContainer
                                          width="100%"
                                          height="100%"
                                        >
                                          <BarChart
                                            data={numberChartData}
                                            margin={{
                                              top: 10,
                                              right: 10,
                                              left: -15,
                                              bottom: 0,
                                            }}
                                          >
                                            <CartesianGrid
                                              stroke="#EEEAE0"
                                              strokeDasharray="4 4"
                                              vertical={false}
                                            />
                                            <XAxis
                                              dataKey="metric"
                                              tick={{
                                                fill: "#898477",
                                                fontSize: 12,
                                              }}
                                              axisLine={false}
                                              tickLine={false}
                                            />
                                            <YAxis
                                              tick={{
                                                fill: "#898477",
                                                fontSize: 11,
                                              }}
                                              axisLine={false}
                                              tickLine={false}
                                            />
                                            <Tooltip
                                              formatter={(value) => [
                                                value ?? "—",
                                                "Value",
                                              ]}
                                              contentStyle={{
                                                borderRadius: "12px",
                                                border: "1px solid #DED6C1",
                                                fontSize: "12px",
                                              }}
                                            />
                                            <Bar
                                              dataKey="value"
                                              fill="#9A8664"
                                              radius={[7, 7, 0, 0]}
                                              maxBarSize={65}
                                            />
                                          </BarChart>
                                        </ResponsiveContainer>
                                      </div>
                                      <p className="mt-2 text-xs text-[#898477]">
                                        This chart compares minimum, average
                                        and maximum values; it is not a
                                        frequency distribution.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ) : question.type === "date" ? (
                                /* Date Answers grouped by calendar date */
                                <div>
                                  <div className="mb-5">
                                    <h4 className="font-semibold text-[#302E29]">
                                      Date-wise Response Distribution
                                    </h4>
                                    <p className="mt-1 text-xs text-[#898477]">
                                      Responses grouped by the date selected by
                                      respondents.
                                    </p>
                                  </div>

                                  {dateChartData.length === 0 ? (
                                    <p className="rounded-xl bg-[#FAF9F5] p-6 text-center text-sm text-[#898477]">
                                      No valid date answers available.
                                    </p>
                                  ) : (
                                    <>
                                      <div className="h-[280px] w-full">
                                        <ResponsiveContainer
                                          width="100%"
                                          height="100%"
                                        >
                                          <BarChart
                                            data={dateChartData}
                                            margin={{
                                              top: 10,
                                              right: 10,
                                              left: -20,
                                              bottom: 25,
                                            }}
                                          >
                                            <CartesianGrid
                                              stroke="#EEEAE0"
                                              strokeDasharray="4 4"
                                              vertical={false}
                                            />
                                            <XAxis
                                              dataKey="label"
                                              angle={-25}
                                              textAnchor="end"
                                              interval={0}
                                              height={55}
                                              tick={{
                                                fill: "#898477",
                                                fontSize: 10,
                                              }}
                                              axisLine={false}
                                              tickLine={false}
                                            />
                                            <YAxis
                                              allowDecimals={false}
                                              tick={{
                                                fill: "#898477",
                                                fontSize: 11,
                                              }}
                                              axisLine={false}
                                              tickLine={false}
                                            />
                                            <Tooltip
                                              formatter={(value) => [
                                                `${value ?? 0} responses`,
                                                "Selected date",
                                              ]}
                                              labelFormatter={(_, payload) =>
                                                payload?.[0]?.payload?.date
                                                  ? formatDateLabel(
                                                      payload[0].payload.date
                                                    )
                                                  : ""
                                              }
                                              contentStyle={{
                                                borderRadius: "12px",
                                                border: "1px solid #DED6C1",
                                                fontSize: "12px",
                                              }}
                                            />
                                            <Bar
                                              dataKey="responses"
                                              fill="#9A8664"
                                              radius={[6, 6, 0, 0]}
                                              maxBarSize={55}
                                            />
                                          </BarChart>
                                        </ResponsiveContainer>
                                      </div>

                                      <div className="mt-7 border-t border-[#EEEAE0] pt-5">
                                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                          <div>
                                            <h4 className="font-semibold text-[#302E29]">
                                              Submitted Date Answers
                                            </h4>
                                            <p className="mt-1 text-xs text-[#898477]">
                                              {validDateAnswers.length} valid
                                              date answers across{" "}
                                              {dateChartData.length} unique
                                              dates.
                                            </p>
                                          </div>
                                          <span className="rounded-full bg-[#F5F2EA] px-3 py-1.5 text-xs font-semibold text-[#777267]">
                                            {expandedDateQuestion === question.id
                                              ? "All answers"
                                              : "Latest 10"}
                                          </span>
                                        </div>

                                        <div className="space-y-2">
                                          {visibleDateAnswers.map(
                                            (answer, answerIndex) => (
                                              <div
                                                key={`${answer.responseId}-${answerIndex}`}
                                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#FAF9F5] px-4 py-3"
                                              >
                                                <span className="text-sm font-medium text-[#302E29]">
                                                  {formatDateLabel(
                                                    getDateKey(answer.value) ??
                                                      answer.value
                                                  )}
                                                </span>
                                                <span className="text-xs text-[#898477]">
                                                  Submitted{" "}
                                                  {formatDate(
                                                    answer.submittedAt
                                                  )}
                                                </span>
                                              </div>
                                            )
                                          )}
                                        </div>

                                        {validDateAnswers.length > 10 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setExpandedDateQuestion(
                                                expandedDateQuestion ===
                                                  question.id
                                                  ? null
                                                  : question.id
                                              )
                                            }
                                            className="mt-4 w-full rounded-xl border border-[#DED6C1] px-4 py-3 text-sm font-semibold text-[#777267] transition hover:bg-[#F8F6F0]"
                                          >
                                            {expandedDateQuestion === question.id
                                              ? "Show Less"
                                              : `Show All ${validDateAnswers.length} Date Answers`}
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              ) : (
                                /* Text and Email Answers */
                                <div>
                                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <h4 className="font-semibold text-[#302E29]">
                                        Submitted Answers
                                      </h4>
                                      <p className="mt-1 text-xs text-[#898477]">
                                        Latest answers received for this
                                        question.
                                      </p>
                                    </div>
                                    <span className="text-xs text-[#898477]">
                                      {question.textAnswers.length} answers
                                    </span>
                                  </div>

                                  {question.textAnswers.length === 0 ? (
                                    <p className="rounded-xl bg-[#FAF9F5] p-6 text-center text-sm text-[#898477]">
                                      No valid answers available.
                                    </p>
                                  ) : (
                                    <>
                                      <div className="space-y-3">
                                        {(expandedTextQuestion === question.id
                                          ? question.textAnswers
                                          : question.textAnswers.slice(0, 20)
                                        ).map((answer, answerIndex) => (
                                          <div
                                            key={`${answer.responseId}-${answerIndex}`}
                                            className="rounded-xl border border-[#EEEAE0] bg-[#FCFBF8] p-4"
                                          >
                                            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#302E29]">
                                              {answer.value}
                                            </p>
                                            <p className="mt-3 text-xs text-[#898477]">
                                              {formatDate(answer.submittedAt)}
                                            </p>
                                          </div>
                                        ))}
                                      </div>

                                      {question.textAnswers.length > 20 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedTextQuestion(
                                              expandedTextQuestion ===
                                                question.id
                                                ? null
                                                : question.id
                                            )
                                          }
                                          className="mt-4 w-full rounded-xl border border-[#DED6C1] px-4 py-3 text-sm font-semibold text-[#777267] transition hover:bg-[#F8F6F0]"
                                        >
                                          {expandedTextQuestion === question.id
                                            ? "Show Latest 20"
                                            : `Show All ${question.textAnswers.length} Answers`}
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </section>
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
                  className="w-full min-w-0 flex-1 rounded-xl border border-[#DED6C1] bg-[#FAF9F5] px-4 py-3 text-sm text-[#302E29] outline-none transition placeholder:text-[#AAA394] focus:border-[#9A8664]"
                />

                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full rounded-xl border border-[#DED6C1] bg-[#FAF9F5] px-4 py-3 text-sm text-[#777267] outline-none focus:border-[#9A8664] md:w-auto"
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
