
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

type PublicFormTheme = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  buttonStyle: "rounded" | "pill" | "square";
  borderRadius: "small" | "medium" | "large";
  backgroundStyle: "solid" | "gradient";
  backgroundImage?: string;
  backgroundImageName?: string;
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

  const theme: PublicFormTheme = form.theme ?? {
    primaryColor: "#B7B09E",
    secondaryColor: "#CFC6B1",
    backgroundColor: "#EBE2CC",
    fontFamily: "Inter",
    buttonStyle: "rounded",
    borderRadius: "medium",
    backgroundStyle: "solid",
  };

  const hasBackgroundImage = Boolean(theme.backgroundImage);

  const pageBackground = hasBackgroundImage
    ? theme.backgroundColor
    : theme.backgroundStyle === "gradient"
      ? `linear-gradient(135deg, ${theme.backgroundColor}, ${theme.secondaryColor})`
      : theme.backgroundColor;

  const pageBackgroundStyle: React.CSSProperties = {
    background: pageBackground,
    backgroundImage: hasBackgroundImage
      ? `linear-gradient(rgba(0,0,0,0.12), rgba(0,0,0,0.12)), url("${theme.backgroundImage}")`
      : undefined,
    backgroundSize: hasBackgroundImage ? "cover" : undefined,
    backgroundPosition: hasBackgroundImage ? "center" : undefined,
    backgroundRepeat: hasBackgroundImage ? "no-repeat" : undefined,
    backgroundAttachment: hasBackgroundImage ? "fixed" : undefined,
    fontFamily: theme.fontFamily,
  };

  const cardRadius =
    theme.borderRadius === "small"
      ? "6px"
      : theme.borderRadius === "large"
        ? "20px"
        : "12px";

  const buttonRadius =
    theme.buttonStyle === "pill"
      ? "9999px"
      : theme.buttonStyle === "square"
        ? "0px"
        : "8px";

  const inputStyle = {
    borderColor: theme.secondaryColor,
    borderRadius: cardRadius,
    color: "#302E29",
  };

  const primaryButtonStyle = {
    backgroundColor: theme.primaryColor,
    borderRadius: buttonRadius,
  };

  const secondaryButtonStyle = {
    borderColor: theme.secondaryColor,
    borderRadius: buttonRadius,
  };

  if (submitted) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-5"
        style={pageBackgroundStyle}
      >
        <div
          className="w-full max-w-lg bg-white p-10 text-center shadow-sm"
          style={{ borderRadius: cardRadius }}
        >
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl"
            style={{
              backgroundColor: theme.secondaryColor,
              color: theme.primaryColor,
            }}
          >
            ✓
          </div>
          <h1
            className="mt-6 text-2xl font-bold"
            style={{ color: theme.primaryColor }}
          >
            Thank you!
          </h1>
          <p className="mt-3 text-sm text-[#777267]">
            Your form has been completed successfully.
          </p>
        </div>
      </main>
    );
  }

  const availabilityStatus = formQuery.data.availabilityStatus;

  if (
    availabilityStatus === "expired" ||
    availabilityStatus === "limit_reached"
  ) {
    const isExpired = availabilityStatus === "expired";

    return (
      <main
        className="flex min-h-screen items-center justify-center px-5"
        style={pageBackgroundStyle}
      >
        <div
          className="w-full max-w-lg bg-white p-10 text-center shadow-sm"
          style={{ borderRadius: cardRadius }}
        >
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl"
            style={{
              backgroundColor: theme.secondaryColor,
              color: theme.primaryColor,
            }}
          >
            {isExpired ? "⌛" : "✓"}
          </div>

          <h1
            className="mt-6 text-2xl font-bold"
            style={{ color: theme.primaryColor }}
          >
            {isExpired ? "Form Expired" : "Response Limit Reached"}
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#777267]">
            {isExpired
              ? "This form has expired and is no longer accepting responses."
              : "This form has reached its maximum response limit and is no longer accepting responses."}
          </p>

          <p className="mt-6 text-xs text-[#777267]">
            Powered by FormFlow
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen px-4 py-12 sm:py-20"
      style={pageBackgroundStyle}
    >
      <div className="mx-auto max-w-2xl">
        <div
          className="bg-white p-6 shadow-sm sm:p-10"
          style={{ borderRadius: cardRadius }}
        >
          <div
            className="mb-8 border-b pb-7"
            style={{ borderColor: theme.secondaryColor }}
          >
            <h1
              className="text-3xl font-bold"
              style={{ color: theme.primaryColor }}
            >
              {form.title}
            </h1>

            {form.description && (
              <p className="mt-3 text-sm leading-6 text-[#777267]">
                {form.description}
              </p>
            )}
          </div>

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

              <div
                className="h-2 overflow-hidden rounded-full"
                style={{ backgroundColor: theme.secondaryColor }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: theme.primaryColor,
                  }}
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
                      className="w-full border p-3 text-sm outline-none focus:ring-1"
                      style={inputStyle}
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
                      className="w-full border p-3 text-sm outline-none focus:ring-1"
                      style={inputStyle}
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
                      className="w-full border p-3 text-sm outline-none focus:ring-1"
                      style={inputStyle}
                    />
                  )}

                  {question.type === "date" && (
                    <input
                      type="date"
                      value={String(answers[question.id] ?? "")}
                      onChange={(e) =>
                        updateAnswer(question.id, e.target.value)
                      }
                      className="w-full border p-3 text-sm outline-none focus:ring-1"
                      style={inputStyle}
                    />
                  )}

                  {question.type === "select" && (
                    <select
                      value={String(answers[question.id] ?? "")}
                      onChange={(e) =>
                        updateAnswer(question.id, e.target.value)
                      }
                      className="w-full border bg-white p-3 text-sm outline-none focus:ring-1"
                      style={inputStyle}
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
                              className="h-4 w-4"
                              style={{ accentColor: theme.primaryColor }}
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {question.type === "rating" && (
                    <div className="flex flex-wrap gap-3">
                      {[1, 2, 3, 4, 5].map((rating) => {
                        const selected = answers[question.id] === rating;

                        return (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => updateAnswer(question.id, rating)}
                            className="h-11 w-11 border text-sm font-semibold"
                            style={{
                              borderRadius: buttonRadius,
                              borderColor: theme.primaryColor,
                              backgroundColor: selected
                                ? theme.primaryColor
                                : "white",
                              color: selected ? "white" : "#514D45",
                            }}
                          >
                            {rating}
                          </button>
                        );
                      })}
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

            <div className="flex items-center gap-3 pt-4">
              {!isFirstPage && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="border px-6 py-4 text-sm font-semibold text-[#514D45] transition"
                  style={secondaryButtonStyle}
                >
                  Previous
                </button>
              )}

              {!isLastPage ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 px-6 py-4 text-sm font-semibold text-white transition"
                  style={primaryButtonStyle}
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="flex-1 px-6 py-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                  style={primaryButtonStyle}
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
