"use client";

import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { trpc } from "../../../utils/trpc";

type AnswerValue = string | number | string[];

type QuestionLogic = {
  action: "show" | "hide";
  questionId: string;
  operator: "equals" | "notEquals" | "contains";
  value: string | number;
};

type QuestionConfig = {
  options?: string[];
  min?: number;
  max?: number;
  logic?: QuestionLogic;
};

type Question = {
  id: string;
  title: string;
  description: string | null;
  type: "text" | "email" | "number" | "select" | "checkbox" | "rating" | "date";
  required: boolean;
  position: number;
  pageNumber: number;
  config?: unknown;
};

function validateQuestions(
  questionsToValidate: Question[],
  answers: Record<string, AnswerValue>
) {
  const newErrors: Record<string, string> = {};

  questionsToValidate.forEach((question) => {
    const answer = answers[question.id];
    const config = question.config as QuestionConfig | null;

    const isEmpty =
      answer === undefined ||
      answer === "" ||
      (Array.isArray(answer) && answer.length === 0);

    if (question.required && isEmpty) {
      newErrors[question.id] = "This question is required.";
      return;
    }

    if (isEmpty) return;

    if (
      question.type === "email" &&
      typeof answer === "string" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)
    ) {
      newErrors[question.id] = "Please enter a valid email address.";
    }

    if (question.type === "number") {
      const number = Number(answer);

      if (!Number.isFinite(number)) {
        newErrors[question.id] = "Please enter a valid number.";
      } else {
        if (config?.min !== undefined && number < config.min) {
          newErrors[question.id] = `Minimum value is ${config.min}.`;
        }

        if (config?.max !== undefined && number > config.max) {
          newErrors[question.id] = `Maximum value is ${config.max}.`;
        }
      }
    }

    if (question.type === "rating" && typeof answer === "number") {
      if (config?.min !== undefined && answer < config.min) {
        newErrors[question.id] = `Minimum value is ${config.min}.`;
      }

      if (config?.max !== undefined && answer > config.max) {
        newErrors[question.id] = `Maximum value is ${config.max}.`;
      }
    }
  });

  return newErrors;
}

function PublicFormContent() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [currentPageNumber, setCurrentPageNumber] = useState(1);

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

  const questions = formQuery.data?.questions ?? [];
  const pages = formQuery.data?.pages ?? [];

  // Calculate conditional visibility across all pages.
  const visibleQuestions: typeof questions = [];
  const visibleAnswers: Record<string, AnswerValue> = {};

  questions.forEach((question) => {
    const config = question.config as QuestionConfig | null;
    const logic = config?.logic;

    let isVisible = true;

    if (logic) {
      const sourceAnswer = visibleAnswers[logic.questionId];

      let conditionMatches = false;

      const hasSourceAnswer =
        sourceAnswer !== undefined &&
        sourceAnswer !== "" &&
        (!Array.isArray(sourceAnswer) || sourceAnswer.length > 0);

      if (hasSourceAnswer) {
        if (logic.operator === "equals") {
          conditionMatches = sourceAnswer === logic.value;
        } else if (logic.operator === "notEquals") {
          conditionMatches = sourceAnswer !== logic.value;
        } else if (logic.operator === "contains") {
          if (typeof sourceAnswer === "string") {
            conditionMatches = sourceAnswer.includes(String(logic.value));
          } else if (Array.isArray(sourceAnswer)) {
            conditionMatches = sourceAnswer.includes(String(logic.value));
          }
        }
      }

      isVisible =
        logic.action === "show"
          ? conditionMatches
          : !conditionMatches;
    }

    if (isVisible) {
      visibleQuestions.push(question);

      if (answers[question.id] !== undefined) {
        visibleAnswers[question.id] = answers[question.id];
      }
    }
  });

  // Remove answers belonging to questions that became hidden.
  const visibleQuestionIds = visibleQuestions
    .map((question) => question.id)
    .join("|");

  useEffect(() => {
    const visibleIds = new Set(
      visibleQuestionIds ? visibleQuestionIds.split("|") : []
    );

    setAnswers((previous) => {
      const cleaned: Record<string, AnswerValue> = {};
      let changed = false;

      Object.entries(previous).forEach(([id, value]) => {
        if (visibleIds.has(id)) {
          cleaned[id] = value;
        } else {
          changed = true;
        }
      });

      return changed ? cleaned : previous;
    });

    setErrors((previous) => {
      const cleaned: Record<string, string> = {};
      let changed = false;

      Object.entries(previous).forEach(([id, value]) => {
        if (visibleIds.has(id)) {
          cleaned[id] = value;
        } else {
          changed = true;
        }
      });

      return changed ? cleaned : previous;
    });
  }, [visibleQuestionIds]);

  // Only pages containing visible questions are shown to respondents.
  const availablePages = pages.filter((page) =>
    visibleQuestions.some(
      (question) => question.pageNumber === page.pageNumber
    )
  );

  const respondentPages =
    availablePages.length > 0 ? availablePages : pages.slice(0, 1);

  const currentPage =
    respondentPages.find(
      (page) => page.pageNumber === currentPageNumber
    ) ?? respondentPages[0];

  const activePageNumber = currentPage?.pageNumber ?? 1;

  const currentPageIndex = Math.max(
    0,
    respondentPages.findIndex(
      (page) => page.pageNumber === activePageNumber
    )
  );

  const currentPageQuestions = visibleQuestions.filter(
    (question) => question.pageNumber === activePageNumber
  );

  const isFirstPage = currentPageIndex === 0;
  const isLastPage =
    currentPageIndex === respondentPages.length - 1;

  const progress =
    respondentPages.length > 0
      ? ((currentPageIndex + 1) / respondentPages.length) * 100
      : 100;

  const handleNext = () => {
    const newErrors = validateQuestions(
      currentPageQuestions,
      visibleAnswers
    );

    setErrors((previous) => ({
      ...previous,
      ...newErrors,
    }));

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    const nextPage = respondentPages[currentPageIndex + 1];

    if (nextPage) {
      setCurrentPageNumber(nextPage.pageNumber);
    }
  };

  const handlePrevious = () => {
    const previousPage = respondentPages[currentPageIndex - 1];

    if (previousPage) {
      setCurrentPageNumber(previousPage.pageNumber);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const newErrors = validateQuestions(
      visibleQuestions,
      visibleAnswers
    );

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstInvalidQuestion = visibleQuestions.find(
        (question) => newErrors[question.id]
      );

      if (firstInvalidQuestion) {
        setCurrentPageNumber(firstInvalidQuestion.pageNumber);
      }

      return;
    }

    submitMutation.mutate({
      slug,
      answers: visibleAnswers,
    });
  };

  if (formQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#EBE2CC]">
        <p className="text-sm text-[#514D45]">
          Loading your form...
        </p>
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

  const form = formQuery.data.form;

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

          {/* Page progress */}
          {respondentPages.length > 1 && (
            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-[#514D45]">
                  {currentPage?.title ?? `Page ${currentPageIndex + 1}`}
                </span>

                <span className="text-xs text-[#777267]">
                  Page {currentPageIndex + 1} of {respondentPages.length}
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-[#EBE2CC]">
                <div
                  className="h-full rounded-full bg-[#81765F] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {currentPage?.description && (
                <p className="mt-3 text-sm text-[#777267]">
                  {currentPage.description}
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {currentPageQuestions.map((question, index) => {
              const config = question.config as QuestionConfig | null;

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
                                    : selected.filter(
                                        (item) => item !== option
                                      )
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

            {/* Page navigation */}
            <div className="flex items-center gap-3 pt-4">
              {!isFirstPage && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="rounded-lg border border-[#DED6C1] px-6 py-4 text-sm font-semibold text-[#514D45] transition hover:bg-[#EBE2CC]"
                >
                  Previous
                </button>
              )}

              {!isLastPage ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 rounded-lg bg-[#302E29] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#514D45]"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="flex-1 rounded-lg bg-[#302E29] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#514D45] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitMutation.isPending
                    ? "Submitting..."
                    : "Submit Form"}
                </button>
              )}
            </div>
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