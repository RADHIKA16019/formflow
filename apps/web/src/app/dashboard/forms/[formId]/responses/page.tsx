"use client";

import { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/utils/trpc";

function ResponsesContent() {
  const params = useParams<{ formId: string }>();
  const formId = params.formId;

  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const responsesQuery = trpc.getFormResponses.useQuery({ formId });
  const questionsQuery = trpc.getQuestionsByForm.useQuery({ formId });

  const deleteResponseMutation = trpc.deleteResponse.useMutation({
    onSuccess: async () => {
      await responsesQuery.refetch();
      setSelectedResponse(null);
    },
  });

  const responses = responsesQuery.data ?? [];
  const questions = questionsQuery.data ?? [];

  const handleDeleteResponse = (responseId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this response? This action cannot be undone."
    );

    if (!confirmed) return;

    deleteResponseMutation.mutate({ responseId });
  };

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

  const handleExportCSV = () => {
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
    link.click();

    URL.revokeObjectURL(url);
  };

  if (responsesQuery.isLoading || questionsQuery.isLoading) {
    return (
      <div className="p-10 text-center text-[#777267]">
        Loading responses...
      </div>
    );
  }

  if (responsesQuery.isError) {
    return (
      <div className="p-10 text-center text-red-600">
        {responsesQuery.error.message}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F6F0] px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <a
            href={`/dashboard/forms/${formId}`}
            className="text-sm text-[#777267] hover:text-black"
          >
            ← Back to Form Builder
          </a>

          <h1 className="mt-5 text-3xl font-bold text-[#302E29]">
            Form Responses
          </h1>

          <p className="mt-2 text-sm text-[#777267]">
            View and manage all your form submissions.
          </p>
        </div>

        <div className="mb-8 rounded-xl border border-[#DED6C1] bg-white p-6">
          <p className="text-sm text-[#777267]">
            Total Responses
          </p>

          <h2 className="mt-2 text-4xl font-bold text-[#302E29]">
            {responses.length}
          </h2>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[#302E29]">
              All Submissions
            </h2>

            <span className="text-sm text-[#777267]">
              {responses.length} responses
            </span>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredResponses.length === 0}
            className="rounded-lg bg-[#302E29] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#49453D] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↓ Export CSV
          </button>
        </div>

        {/* Search and Date Filters */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Search responses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-[#DED6C1] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#B7B09E]"
          />

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-lg border border-[#DED6C1] bg-white px-4 py-3 text-sm outline-none focus:border-[#B7B09E]"
          />

          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setDateFilter("");
            }}
            className="rounded-lg border border-[#DED6C1] px-4 py-3 text-sm font-medium hover:bg-[#F8F6F0]"
          >
            Clear
          </button>
        </div>

        <p className="mb-4 text-xs text-[#777267]">
          Showing {filteredResponses.length} of {responses.length} responses
        </p>

        {deleteResponseMutation.isError && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            Failed to delete response: {deleteResponseMutation.error.message}
          </div>
        )}

        {filteredResponses.length === 0 ? (
          <div className="rounded-xl border border-[#DED6C1] bg-white p-12 text-center">
            <h3 className="text-lg font-semibold text-[#302E29]">
              No responses yet
            </h3>

            <p className="mt-2 text-sm text-[#777267]">
              Responses will appear here when someone submits your form.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredResponses.map((response) => {
              const answers = response.answers as Record<string, unknown>;
              const isSelected = selectedResponse === response.id;

              return (
                <div
                  key={response.id}
                  className="overflow-hidden rounded-xl border border-[#DED6C1] bg-white"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedResponse(
                        isSelected ? null : response.id
                      )
                    }
                    className="flex w-full items-center justify-between p-5 text-left hover:bg-[#F8F6F0]"
                  >
                    <div>
                      <p className="font-semibold text-[#302E29]">
                        {response.respondentEmail || "Anonymous respondent"}
                      </p>

                      <p className="mt-1 text-xs text-[#777267]">
                        Submitted:{" "}
                        {new Date(response.submittedAt).toLocaleString()}
                      </p>
                    </div>

                    <span className="text-sm text-[#777267]">
                      {isSelected ? "− Hide" : "+ View"}
                    </span>
                  </button>

                  {isSelected && (
                    <div className="border-t border-[#DED6C1] p-5">
                      <div className="mb-6 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeleteResponse(response.id)}
                          disabled={deleteResponseMutation.isPending}
                          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deleteResponseMutation.isPending
                            ? "Deleting..."
                            : "Delete Response"}
                        </button>
                      </div>

                      {Object.entries(answers).map(([questionId, answer]) => {
                        const question = questions.find(
                          (q) => q.id === questionId
                        );

                        return (
                          <div
                            key={questionId}
                            className="mb-5 last:mb-0"
                          >
                            <p className="text-sm font-semibold text-[#302E29]">
                              {question?.title || "Question"}
                            </p>

                            <p className="mt-2 whitespace-pre-wrap text-sm text-[#777267]">
                              {Array.isArray(answer)
                                ? answer.join(", ")
                                : typeof answer === "object" && answer !== null
                                  ? JSON.stringify(answer)
                                  : String(answer ?? "No answer")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function ResponsesPage() {
  return (
    <Suspense fallback={<div className="p-10">Loading...</div>}>
      <ResponsesContent />
    </Suspense>
  );
}
