
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "../../../utils/trpc";

type TemplateQuestion = {
  title: string;
  description?: string;
  type: "text" | "email" | "number" | "select" | "checkbox" | "rating" | "date";
  required: boolean;
  config?: {
    options?: string[];
    min?: number;
    max?: number;
  };
};

type FormTemplate = {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  questions: TemplateQuestion[];
};

const templates: FormTemplate[] = [
  {
    id: "customer-feedback",
    title: "Customer Feedback",
    description: "Collect customer opinions and improve your products and services.",
    category: "Feedback",
    icon: "💬",
    questions: [
      { title: "What is your name?", type: "text", required: false },
      { title: "Your email address", type: "email", required: true },
      {
        title: "How satisfied are you with our service?",
        type: "rating",
        required: true,
        config: { min: 1, max: 5 },
      },
      { title: "What did you like most?", type: "text", required: false },
      { title: "How can we improve?", type: "text", required: false },
    ],
  },
  {
    id: "event-registration",
    title: "Event Registration",
    description: "Register participants for your upcoming events.",
    category: "Events",
    icon: "🎟️",
    questions: [
      { title: "Full name", type: "text", required: true },
      { title: "Email address", type: "email", required: true },
      { title: "Phone number", type: "number", required: true },
      {
        title: "Which session would you like to attend?",
        type: "select",
        required: true,
        config: {
          options: ["Morning Session", "Afternoon Session", "Evening Session"],
        },
      },
      { title: "Any special requirements?", type: "text", required: false },
    ],
  },
  {
    id: "job-application",
    title: "Job Application",
    description: "Collect applications and candidate information.",
    category: "HR",
    icon: "💼",
    questions: [
      { title: "Full name", type: "text", required: true },
      { title: "Email address", type: "email", required: true },
      { title: "Phone number", type: "number", required: true },
      { title: "Position you are applying for", type: "text", required: true },
      { title: "Years of experience", type: "number", required: true },
      { title: "Tell us about yourself", type: "text", required: false },
    ],
  },
  {
    id: "contact-form",
    title: "Contact Form",
    description: "Give visitors a simple way to contact your business.",
    category: "Business",
    icon: "📩",
    questions: [
      { title: "Your name", type: "text", required: true },
      { title: "Email address", type: "email", required: true },
      {
        title: "What is your inquiry about?",
        type: "select",
        required: true,
        config: {
          options: ["General Inquiry", "Support", "Sales", "Partnership"],
        },
      },
      { title: "Your message", type: "text", required: true },
    ],
  },
  {
    id: "course-evaluation",
    title: "Course Evaluation",
    description: "Understand student experiences and evaluate your courses.",
    category: "Education",
    icon: "🎓",
    questions: [
      { title: "Student name", type: "text", required: false },
      { title: "Course name", type: "text", required: true },
      {
        title: "Rate the course overall",
        type: "rating",
        required: true,
        config: { min: 1, max: 5 },
      },
      {
        title: "Was the course content easy to understand?",
        type: "select",
        required: true,
        config: {
          options: ["Very Easy", "Easy", "Average", "Difficult"],
        },
      },
      { title: "Suggestions for improvement", type: "text", required: false },
    ],
  },
  {
    id: "product-survey",
    title: "Product Survey",
    description: "Discover customer preferences and product expectations.",
    category: "Research",
    icon: "📊",
    questions: [
      { title: "Your name", type: "text", required: false },
      { title: "Email address", type: "email", required: false },
      { title: "Which product do you use?", type: "text", required: true },
      {
        title: "How often do you use this product?",
        type: "select",
        required: true,
        config: {
          options: ["Daily", "Weekly", "Monthly", "Rarely"],
        },
      },
      {
        title: "How would you rate this product?",
        type: "rating",
        required: true,
        config: { min: 1, max: 5 },
      },
      { title: "What would you improve?", type: "text", required: false },
    ],
  },
];

const templateColors: Record<
  string,
  {
    background: string;
    primary: string;
    secondary: string;
    button: string;
  }
> = {
  "customer-feedback": {
    background: "#EBE2CC",
    primary: "#B7B09E",
    secondary: "#CFC6B1",
    button: "#8A7652",
  },
  "event-registration": {
    background: "#E8EFF8",
    primary: "#7195BE",
    secondary: "#C4D5E8",
    button: "#456B96",
  },
  "job-application": {
    background: "#EEE9F5",
    primary: "#A18AB9",
    secondary: "#D6C9E5",
    button: "#73568F",
  },
  "contact-form": {
    background: "#E8F0E9",
    primary: "#87A68B",
    secondary: "#C6D9C8",
    button: "#527B59",
  },
  "course-evaluation": {
    background: "#F5E9DB",
    primary: "#C69A70",
    secondary: "#E5CBB0",
    button: "#A66F40",
  },
  "product-survey": {
    background: "#ECECEC",
    primary: "#929292",
    secondary: "#D1D1D1",
    button: "#494949",
  },
};

export default function TemplatesPage() {
  const router = useRouter();

  const [selectedTemplate, setSelectedTemplate] =
    useState<FormTemplate | null>(null);

  const [search, setSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [createdFormId, setCreatedFormId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const utils = trpc.useUtils();

  const createFormMutation = trpc.createForm.useMutation();
  const createQuestionMutation = trpc.createQuestion.useMutation();

  const filteredTemplates = templates.filter((template) => {
    const query = search.trim().toLowerCase();

    return (
      template.title.toLowerCase().includes(query) ||
      template.description.toLowerCase().includes(query) ||
      template.category.toLowerCase().includes(query)
    );
  });

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate || isCreating) return;

    setIsCreating(true);
    setErrorMessage("");
    setCreatedFormId(null);

    let newFormId: string | null = null;

    try {
      const result = await createFormMutation.mutateAsync({
        title: selectedTemplate.title,
        description: selectedTemplate.description,
      });

      newFormId = result.form.id;
      setCreatedFormId(newFormId);

      for (const question of selectedTemplate.questions) {
        await createQuestionMutation.mutateAsync({
          formId: newFormId,
          title: question.title,
          description: question.description,
          type: question.type,
          required: question.required,
          config: question.config,
        });
      }

      await utils.getMyForms.invalidate();

      router.push(`/dashboard/forms/${newFormId}`);
    } catch (error) {
      console.error("Template creation failed:", error);

      setErrorMessage(
        newFormId
          ? "Your form was created, but some questions could not be added. You can open the form and finish editing it."
          : error instanceof Error
            ? error.message
            : "Unable to create form. Please try again."
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8F6F0] px-4 py-8 text-[#302E29] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-2 text-sm text-[#817B6E] hover:text-[#302E29]"
          >
            ← Back to Dashboard
          </Link>

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Form Templates
              </h1>

              <p className="mt-2 text-sm text-[#817B6E]">
                Start with a ready-made template and customize it your way.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="rounded-xl border border-[#DED6C1] px-5 py-3 text-center text-sm font-medium transition hover:bg-white"
            >
              Create from Scratch
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="mb-8">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search templates..."
            className="w-full max-w-lg rounded-xl border border-[#E8E2D5] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-[#A29B8D] focus:border-[#817B6E]"
          />
        </div>

        {/* Template Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => {
            const colors = templateColors[template.id];

            return (
              <div
                key={template.id}
                className="overflow-hidden rounded-2xl border border-[#DED6C1] bg-white transition hover:-translate-y-1 hover:shadow-md"
              >
                {/* Colored Form Preview */}
                <div
                  className="relative p-5"
                  style={{ backgroundColor: colors.background }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className="h-2 w-20 rounded-full"
                      style={{ backgroundColor: colors.primary }}
                    />
                    <span className="text-xl">{template.icon}</span>
                  </div>

                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    <div
                      className="mb-3 h-2 w-2/3 rounded-full"
                      style={{ backgroundColor: colors.primary }}
                    />

                    <div className="mb-4 space-y-2">
                      <div className="h-2 w-full rounded-full bg-gray-200" />
                      <div className="h-2 w-3/4 rounded-full bg-gray-200" />
                    </div>

                    <div
                      className="mb-3 rounded-lg border p-3"
                      style={{ borderColor: colors.secondary }}
                    >
                      <div className="mb-2 h-1.5 w-1/3 rounded-full bg-gray-200" />
                      <div className="h-6 rounded-md bg-gray-50" />
                    </div>

                    <div
                      className="mb-3 rounded-lg border p-3"
                      style={{ borderColor: colors.secondary }}
                    >
                      <div className="mb-2 h-1.5 w-1/2 rounded-full bg-gray-200" />
                      <div className="h-6 rounded-md bg-gray-50" />
                    </div>

                    <div
                      className="h-7 w-24 rounded-lg"
                      style={{ backgroundColor: colors.button }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-[#817B6E]">
                      FORM PREVIEW
                    </span>
                    <span className="text-[10px] text-[#817B6E]">
                      {template.questions.length} questions
                    </span>
                  </div>
                </div>

                {/* Template Details */}
                <div className="p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-[#F3F0E7] px-3 py-1 text-xs font-medium text-[#817B6E]">
                      {template.category}
                    </span>
                    <span className="text-xs text-[#969080]">
                      {template.questions.length} Questions
                    </span>
                  </div>

                  <h2 className="text-lg font-semibold">
                    {template.title}
                  </h2>

                  <p className="mt-2 min-h-[48px] text-sm leading-6 text-[#817B6E]">
                    {template.description}
                  </p>

                  <div className="mt-5 flex items-center justify-end border-t border-[#F0ECE3] pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setErrorMessage("");
                        setCreatedFormId(null);
                      }}
                      className="rounded-xl bg-[#302E29] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#49453D]"
                    >
                      Preview →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="rounded-2xl border border-[#E8E2D5] bg-white p-12 text-center">
            <h2 className="font-semibold">No templates found</h2>
            <p className="mt-2 text-sm text-[#817B6E]">
              Try searching for another template.
            </p>
          </div>
        )}

        {/* Preview Modal */}
        {selectedTemplate && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
            onClick={() => {
              if (!isCreating) setSelectedTemplate(null);
            }}
          >
            <div
              className="my-auto w-full max-w-2xl rounded-2xl border border-[#E8E2D5] bg-[#F8F6F0] p-6 shadow-xl sm:p-8"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 text-3xl">
                    {selectedTemplate.icon}
                  </div>

                  <span className="text-xs font-medium text-[#817B6E]">
                    {selectedTemplate.category}
                  </span>

                  <h2 className="mt-1 text-2xl font-semibold">
                    {selectedTemplate.title}
                  </h2>

                  <p className="mt-2 text-sm text-[#817B6E]">
                    {selectedTemplate.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedTemplate(null)}
                  disabled={isCreating}
                  className="rounded-lg px-3 py-2 text-xl text-[#817B6E] hover:bg-[#E8E2D5] disabled:opacity-50"
                  aria-label="Close preview"
                >
                  ×
                </button>
              </div>

              <div className="my-6 max-h-[45vh] space-y-3 overflow-y-auto">
                {selectedTemplate.questions.map((question, index) => (
                  <div
                    key={`${selectedTemplate.id}-${index}`}
                    className="rounded-xl border border-[#E8E2D5] bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {index + 1}. {question.title}
                      </p>

                      {question.required && (
                        <span className="text-xs text-[#9B6654]">
                          Required
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-xs capitalize text-[#969080]">
                      {question.type}
                    </p>

                    {question.config?.options && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {question.config.options.map((option) => (
                          <span
                            key={option}
                            className="rounded-lg border border-[#E8E2D5] px-3 py-1.5 text-xs text-[#817B6E]"
                          >
                            {option}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {errorMessage && (
                <div className="mb-4 rounded-xl border border-[#E8D5CC] bg-[#F8EBE5] p-4 text-sm text-[#8C4937]">
                  <p>{errorMessage}</p>

                  {createdFormId && (
                    <Link
                      href={`/dashboard/forms/${createdFormId}`}
                      className="mt-2 inline-block font-semibold underline"
                    >
                      Open created form
                    </Link>
                  )}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedTemplate(null)}
                  disabled={isCreating}
                  className="rounded-xl border border-[#DED6C1] px-5 py-3 text-sm font-medium transition hover:bg-white disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleCreateFromTemplate}
                  disabled={isCreating}
                  className="rounded-xl bg-[#302E29] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#49453D] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreating ? "Creating Template..." : "Use This Template"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
