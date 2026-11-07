
"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { useState } from "react";
import { trpc } from "../../../utils/trpc";

type AnswerValue = string | number | string[];

function PublicFormContent() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const formQuery = trpc.getPublicFormBySlug.useQuery(
    { slug },
    { enabled: Boolean(slug) }
  );

    const submitMutation = trpc.submitPublicResponse.useMutation({
    onSuccess: () => {
        setSubmitted(true);
    },
    });

  const updateAnswer = (questionId: string, value: AnswerValue) => {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [questionId]: "",
    }));
  };

  if (formQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#EBE2CC]">
        <p className="text-sm text-[#514D45]">Loading your form...</p>
      </main>
    );
  }

  if (formQuery.isError || !formQuery.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#EBE2CC] px-5">
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-[#302E29]">
            Form unavailable
          </h1>
          <p className="mt-3 text-sm text-[#777267]">
            This form does not exist or has not been published.
          </p>
        </div>
      </main>
    );
  }

  const { form, questions } = formQuery.data;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const newErrors: Record<string, string> = {};

    questions.forEach((question) => {
      const answer = answers[question.id];

      if (question.required) {
        const isEmpty =
          answer === undefined ||
          answer === "" ||
          (Array.isArray(answer) && answer.length === 0);

        if (isEmpty) {
          newErrors[question.id] = "This question is required.";
        }
      }

      if (
        question.type === "email" &&
        typeof answer === "string" &&
        answer.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)
      ) {
        newErrors[question.id] = "Please enter a valid email address.";
      }

      if (
        question.type === "number" &&
        typeof answer === "string" &&
        answer.trim() &&
        !Number.isFinite(Number(answer))
      ) {
        newErrors[question.id] = "Please enter a valid number.";
      }
    });

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    submitMutation.mutate({
    slug,
    answers,
    });
  };

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#EBE2CC] px-5">
        <div className="w-full max-w-lg rounded-2xl bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EBE2CC] text-3xl">
            ✓
          </div>
          <h1 className="mt-6 text-2xl font-bold text-[#302E29]">
            Thank you!
          </h1>
          <p className="mt-3 text-sm text-[#777267]">
            Your form has been completed successfully.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#EBE2CC] px-4 py-12 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-10">
          <div className="mb-8 border-b border-[#EAE6DC] pb-7">
            <h1 className="text-3xl font-bold text-[#302E29]">
              {form.title}
            </h1>
            {form.description && (
              <p className="mt-3 text-sm leading-6 text-[#777267]">
                {form.description}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {questions.map((question, index) => {
              const config = question.config as {
                options?: string[];
                min?: number;
                max?: number;
              } | null;

              return (
                <div key={question.id}>
                  <label className="mb-3 block text-base font-semibold text-[#302E29]">
                    {index + 1}. {question.title}
                    {question.required && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </label>

                  {question.description && (
                    <p className="mb-3 text-sm text-[#777267]">
                      {question.description}
                    </p>
                  )}

                  {question.type === "text" && (
                    <textarea
                      value={String(answers[question.id] ?? "")}
                      onChange={(e) =>
                        updateAnswer(question.id, e.target.value)
                      }
                      rows={3}
                      placeholder="Type your answer..."
                      className="w-full rounded-lg border border-[#DED6C1] p-3 text-sm outline-none focus:border-[#A69C84]"
                    />
                  )}

                  {question.type === "email" && (
                    <input
                      type="email"
                      value={String(answers[question.id] ?? "")}
                      onChange={(e) =>
                        updateAnswer(question.id, e.target.value)
                      }
                      placeholder="name@example.com"
                      className="w-full rounded-lg border border-[#DED6C1] p-3 text-sm outline-none focus:border-[#A69C84]"
                    />
                  )}

                  {question.type === "number" && (
                    <input
                      type="number"
                      value={String(answers[question.id] ?? "")}
                      onChange={(e) =>
                        updateAnswer(question.id, e.target.value)
                      }
                      min={config?.min}
                      max={config?.max}
                      placeholder="Enter a number"
                      className="w-full rounded-lg border border-[#DED6C1] p-3 text-sm outline-none focus:border-[#A69C84]"
                    />
                  )}

                  {question.type === "date" && (
                    <input
                      type="date"
                      value={String(answers[question.id] ?? "")}
                      onChange={(e) =>
                        updateAnswer(question.id, e.target.value)
                      }
                      className="w-full rounded-lg border border-[#DED6C1] p-3 text-sm outline-none focus:border-[#A69C84]"
                    />
                  )}

                  {question.type === "select" && (
                    <select
                      value={String(answers[question.id] ?? "")}
                      onChange={(e) =>
                        updateAnswer(question.id, e.target.value)
                      }
                      className="w-full rounded-lg border border-[#DED6C1] bg-white p-3 text-sm outline-none focus:border-[#A69C84]"
                    >
                      <option value="">Choose an option</option>
                      {config?.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  )}

                  {question.type === "checkbox" && (
                    <div className="space-y-3">
                      {config?.options?.map((option) => {
                        const selected = Array.isArray(answers[question.id])
                          ? (answers[question.id] as string[])
                          : [];

                        return (
                          <label
                            key={option}
                            className="flex items-center gap-3 text-sm text-[#514D45]"
                          >
                            <input
                              type="checkbox"
                              checked={selected.includes(option)}
                              onChange={(e) => {
                                updateAnswer(
                                  question.id,
                                  e.target.checked
                                    ? [...selected, option]
                                    : selected.filter((item) => item !== option)
                                );
                              }}
                              className="h-4 w-4 accent-[#81765F]"
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {question.type === "rating" && (
                    <div className="flex flex-wrap gap-3">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => updateAnswer(question.id, rating)}
                          className={`h-11 w-11 rounded-lg border text-sm font-semibold ${
                            answers[question.id] === rating
                              ? "border-[#81765F] bg-[#81765F] text-white"
                              : "border-[#DED6C1] text-[#514D45] hover:bg-[#EBE2CC]"
                          }`}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                  )}

                  {errors[question.id] && (
                    <p className="mt-2 text-xs text-red-600">
                      {errors[question.id]}
                    </p>
                  )}
                </div>
              );
            })}

{submitMutation.isError && (
  <p className="text-sm text-red-600">
    {submitMutation.error.message}
  </p>
)}

{submitMutation.isPending && (
  <p className="text-sm text-[#777267]">
    Submitting your response...
  </p>
)}

            <button
  type="submit"
  disabled={submitMutation.isPending}
  className="w-full rounded-lg bg-[#302E29] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#514D45] disabled:cursor-not-allowed disabled:opacity-50"
>
  {submitMutation.isPending ? "Submitting..." : "Submit Form"}
</button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-[#777267]">
          Powered by FormFlow
        </p>
      </div>
    </main>
  );
}

export default function PublicFormPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#EBE2CC]">
          <p className="text-sm text-[#514D45]">
            Loading your form...
          </p>
        </main>
      }
    >
      <PublicFormContent />
    </Suspense>
  );
}
