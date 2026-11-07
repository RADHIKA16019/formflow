
"use client";

import { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/utils/trpc";

function ResponsesContent() {
  const params = useParams<{ formId: string }>();
  const formId = params.formId;

  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);

  const responsesQuery = trpc.getFormResponses.useQuery({ formId });
  const questionsQuery = trpc.getQuestionsByForm.useQuery({ formId });

  const responses = responsesQuery.data ?? [];
  const questions = questionsQuery.data ?? [];

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

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#302E29]">
            All Submissions
          </h2>

          <span className="text-sm text-[#777267]">
            {responses.length} responses
          </span>
        </div>

        {responses.length === 0 ? (
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
            {responses.map((response) => {
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
