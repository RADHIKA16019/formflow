
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import { trpc } from "@/utils/trpc";

const questionTypes = [
  { label: "Short Text", value: "text" },
  { label: "Email", value: "email" },
  { label: "Number", value: "number" },
  { label: "Dropdown", value: "select" },
  { label: "Checkbox", value: "checkbox" },
  { label: "Rating", value: "rating" },
  { label: "Date", value: "date" },
] as const;

type QuestionType = (typeof questionTypes)[number]["value"];

type LogicOperator = "equals" | "notEquals" | "contains";

type QuestionLogic = {
  action: "show" | "hide";
  questionId: string;
  operator: LogicOperator;
  value: string | number;
};

type QuestionConfig = {
  options?: string[];
  min?: number;
  max?: number;
  logic?: QuestionLogic;
};

type QuestionCardData = {
  id: string;
  title: string;
  description: string | null;
  type: QuestionType;
  required: boolean;
  config?: unknown;
};

type AnswerValue = string | number | string[];
type PreviewAnswers = Record<string, AnswerValue>;

function getConfig(value: unknown): QuestionConfig {
  if (!value || typeof value !== "object") return {};
  return value as QuestionConfig;
}

function getOperators(sourceType: QuestionType): {
  label: string;
  value: LogicOperator;
}[] {
  if (sourceType === "checkbox") {
    return [{ label: "Contains", value: "contains" }];
  }

  if (sourceType === "text" || sourceType === "email") {
    return [
      { label: "Equals", value: "equals" },
      { label: "Does not equal", value: "notEquals" },
      { label: "Contains", value: "contains" },
    ];
  }

  return [
    { label: "Equals", value: "equals" },
    { label: "Does not equal", value: "notEquals" },
  ];
}

// Evaluate conditional logic using an earlier question's answer.
function matchesCondition(
  sourceQuestion: QuestionCardData,
  answer: AnswerValue | undefined,
  logic: QuestionLogic
): boolean {
  // An unanswered question never matches, including notEquals.
  if (
    answer === undefined ||
    answer === null ||
    answer === "" ||
    (Array.isArray(answer) && answer.length === 0)
  ) {
    return false;
  }

  if (sourceQuestion.type === "checkbox") {
    if (logic.operator !== "contains") return false;

    return Array.isArray(answer)
      ? answer.includes(String(logic.value))
      : String(answer).includes(String(logic.value));
  }

  if (
    sourceQuestion.type === "number" ||
    sourceQuestion.type === "rating"
  ) {
    const actual = Number(answer);
    const expected = Number(logic.value);

    if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
      return false;
    }

    if (logic.operator === "equals") return actual === expected;
    if (logic.operator === "notEquals") return actual !== expected;

    return false;
  }

  const actual = String(answer);
  const expected = String(logic.value);

  if (logic.operator === "equals") return actual === expected;
  if (logic.operator === "notEquals") return actual !== expected;
  if (logic.operator === "contains") return actual.includes(expected);

  return false;
}

// Calculate which questions should currently be visible.
function calculateVisibleQuestions(
  questions: QuestionCardData[],
  answers: PreviewAnswers
): QuestionCardData[] {
  const visibleQuestions: QuestionCardData[] = [];

  for (const question of questions) {
    const logic = getConfig(question.config).logic;

    if (!logic) {
      visibleQuestions.push(question);
      continue;
    }

    const sourceQuestion = questions.find(
      (item) => item.id === logic.questionId
    );

    if (!sourceQuestion) {
      visibleQuestions.push(question);
      continue;
    }

    // A hidden source question cannot provide an answer.
    const sourceIsVisible = visibleQuestions.some(
      (item) => item.id === logic.questionId
    );

    const matches = sourceIsVisible
      ? matchesCondition(
          sourceQuestion,
          answers[logic.questionId],
          logic
        )
      : false;

    const shouldShow =
      logic.action === "show" ? matches : !matches;

    if (shouldShow) {
      visibleQuestions.push(question);
    }
  }

  return visibleQuestions;
}

// Sortable question card
function SortableQuestionCard({
  question,
  index,
  onEdit,
  onDelete,
  isDeleting,
  logicDescription,
}: {
  question: QuestionCardData;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  logicDescription?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms ease",
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 10 : 0,
  };

  const config = getConfig(question.config);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border bg-white py-5 pl-16 pr-5 transition-all duration-200 ${
        isDragging
          ? "border-[#B7B09E] shadow-lg"
          : "border-border hover:border-[#B7B09E] hover:shadow-sm"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder question"
        title="Drag to reorder"
        className="absolute left-4 top-1/2 flex size-9 -translate-y-1/2 touch-none cursor-grab items-center justify-center rounded-lg border border-border bg-white text-xl text-muted transition hover:border-[#B7B09E] hover:bg-cream hover:text-foreground active:cursor-grabbing"
      >
        ⠿
      </button>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-muted">
          QUESTION {index + 1}
        </p>

        <span className="rounded-md bg-cream px-3 py-1 text-xs font-medium capitalize">
          {question.type}
        </span>
      </div>

      <h3 className="mt-3 font-semibold text-foreground">
        {question.title}
      </h3>

      {question.description && (
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {question.description}
        </p>
      )}

      {(question.type === "select" || question.type === "checkbox") && (
        <div className="mt-4 space-y-2">
          {config.options?.map((option, optionIndex) => (
            <p
              key={optionIndex}
              className="flex items-center gap-2 text-sm text-muted"
            >
              <span>
                {question.type === "checkbox" ? "☐" : "○"}
              </span>
              {option}
            </p>
          ))}
        </div>
      )}

      {(question.type === "number" || question.type === "rating") && (
        <p className="mt-3 text-xs text-muted">
          Range: {config.min ?? "No minimum"} –{" "}
          {config.max ?? "No maximum"}
        </p>
      )}

      {config.logic && (
        <div className="mt-4 rounded-lg border border-[#DED6C1] bg-[#FAF9F6] p-3">
          <p className="text-xs font-semibold text-[#766747]">
            <span className="mr-1">↳</span>
            CONDITIONAL LOGIC
          </p>
          <p className="mt-1 text-sm text-foreground">
            {logicDescription ??
              `${config.logic.action === "show" ? "Show" : "Hide"} when condition matches`}
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <span
          className={`text-xs font-medium ${
            question.required ? "text-[#8A7652]" : "text-muted"
          }`}
        >
          {question.required ? "Required" : "Optional"}
        </span>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-border px-3 py-2 text-xs font-medium transition hover:bg-cream"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// Interactive respondent-facing preview question
function QuestionPreview({
  question,
  index,
  answer,
  onChange,
}: {
  question: QuestionCardData;
  index: number;
  answer: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  const config = getConfig(question.config);

  const inputClass =
    "w-full rounded-lg border border-border bg-white px-4 py-3 text-sm outline-none transition focus:border-[#B7B09E]";

  return (
    <div className="space-y-3">
      <div>
        <label className="text-base font-semibold text-foreground">
          {index + 1}. {question.title}
          {question.required && (
            <span className="ml-1 text-red-500">*</span>
          )}
        </label>

        {question.description && (
          <p className="mt-1 text-sm text-muted">
            {question.description}
          </p>
        )}
      </div>

      {question.type === "text" && (
        <input
          type="text"
          value={typeof answer === "string" ? answer : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer..."
          className={inputClass}
        />
      )}

      {question.type === "email" && (
        <input
          type="email"
          value={typeof answer === "string" ? answer : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="name@example.com"
          className={inputClass}
        />
      )}

      {question.type === "number" && (
        <input
          type="number"
          min={config.min}
          max={config.max}
          value={
            typeof answer === "string" || typeof answer === "number"
              ? answer
              : ""
          }
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter a number (${config.min ?? "any"} – ${config.max ?? "any"})`}
          className={inputClass}
        />
      )}

      {question.type === "date" && (
        <input
          type="date"
          value={typeof answer === "string" ? answer : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}

      {question.type === "select" && (
        <select
          value={typeof answer === "string" ? answer : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">Select an option</option>

          {config.options?.map((option, i) => (
            <option key={i} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {question.type === "checkbox" && (
        <div className="space-y-3">
          {config.options?.map((option, i) => {
            const selected = Array.isArray(answer)
              ? answer.includes(option)
              : false;

            return (
              <label
                key={i}
                className="flex cursor-pointer items-center gap-3 text-sm text-foreground"
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => {
                    const current = Array.isArray(answer)
                      ? answer
                      : [];

                    const updated = e.target.checked
                      ? [...current, option]
                      : current.filter((item) => item !== option);

                    onChange(updated);
                  }}
                  className="size-4 accent-[#B7B09E]"
                />
                {option}
              </label>
            );
          })}
        </div>
      )}

      {question.type === "rating" && (
        <div className="flex flex-wrap gap-2">
          {Array.from(
            {
              length: Math.min(
                Math.max(
                  (config.max ?? 5) - (config.min ?? 1) + 1,
                  1
                ),
                20
              ),
            },
            (_, i) => i + (config.min ?? 1)
          ).map((value) => {
            const isSelected = Number(answer) === value;

            return (
              <button
                type="button"
                key={value}
                onClick={() => onChange(value)}
                className={`flex size-10 items-center justify-center rounded-lg border text-sm font-medium transition ${
                  isSelected
                    ? "border-[#8A7652] bg-[#DED6C1] text-[#302E29]"
                    : "border-border bg-white text-muted hover:border-[#B7B09E] hover:bg-cream"
                }`}
              >
                {value}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FormBuilder() {
  const params = useParams<{ formId: string }>();
  const formId = params.formId;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<QuestionType>("text");
  const [required, setRequired] = useState(false);

  const [options, setOptions] = useState(["Option 1", "Option 2"]);
  const [min, setMin] = useState("1");
  const [max, setMax] = useState("5");

  // Conditional logic editor state
  const [logicEnabled, setLogicEnabled] = useState(false);
  const [logicAction, setLogicAction] = useState<"show" | "hide">("show");
  const [logicQuestionId, setLogicQuestionId] = useState("");
  const [logicOperator, setLogicOperator] =
    useState<LogicOperator>("equals");
  const [logicValue, setLogicValue] = useState("");

  // Interactive preview answers
  const [previewAnswers, setPreviewAnswers] =
    useState<PreviewAnswers>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const {
    data: form,
    isLoading: isFormLoading,
    isError: isFormError,
  } = trpc.getFormById.useQuery({ formId });

  const {
    data: questions,
    isLoading: areQuestionsLoading,
    isError: areQuestionsError,
  } = trpc.getQuestionsByForm.useQuery({ formId });

  const utils = trpc.useUtils();

  // Calculate preview visibility from the current answers.
  const questionList = questions ?? [];

  const visiblePreviewQuestions = useMemo(
    () =>
      calculateVisibleQuestions(
        questionList as QuestionCardData[],
        previewAnswers
      ),
    [questionList, previewAnswers]
  );

const visibleQuestionIds = useMemo(
  () => visiblePreviewQuestions.map((question) => question.id).join("|"),
  [visiblePreviewQuestions]
);

// Clear answers only when the visible question list changes.
useEffect(() => {
  const visibleIds = new Set(
    visibleQuestionIds ? visibleQuestionIds.split("|") : []
  );

  setPreviewAnswers((current) => {
    const updated = { ...current };
    let changed = false;

    for (const questionId of Object.keys(updated)) {
      if (!visibleIds.has(questionId)) {
        delete updated[questionId];
        changed = true;
      }
    }

    return changed ? updated : current;
  });
}, [visibleQuestionIds]);

  const handlePreviewAnswerChange = (
    questionId: string,
    value: AnswerValue
  ) => {
    setPreviewAnswers((current) => ({
      ...current,
      [questionId]: value,
    }));
  };

  const openPreview = () => {
    setPreviewAnswers({});
    setIsPreviewOpen(true);
  };

  const refreshQuestions = async () => {
    await utils.getQuestionsByForm.invalidate({ formId });
  };

  const resetFields = () => {
    setTitle("");
    setDescription("");
    setType("text");
    setRequired(false);
    setOptions(["Option 1", "Option 2"]);
    setMin("1");
    setMax("5");

    setLogicEnabled(false);
    setLogicAction("show");
    setLogicQuestionId("");
    setLogicOperator("equals");
    setLogicValue("");

    setEditingQuestionId(null);
    setIsModalOpen(false);
  };

  const createQuestionMutation = trpc.createQuestion.useMutation({
    onSuccess: async () => {
      await refreshQuestions();
      resetFields();
    },
  });

  const updateQuestionMutation = trpc.updateQuestion.useMutation({
    onSuccess: async () => {
      await refreshQuestions();
      resetFields();
    },
  });

  const deleteQuestionMutation = trpc.deleteQuestion.useMutation({
    onSuccess: refreshQuestions,
  });

  const reorderQuestionsMutation = trpc.reorderQuestions.useMutation({
    onSuccess: refreshQuestions,
  });

  const refreshForm = async () => {
    await utils.getFormById.invalidate({ formId });
    await utils.getMyForms.invalidate();
  };

  const publishMutation = trpc.publishForm.useMutation({
    onSuccess: refreshForm,
  });

  const unpublishMutation = trpc.unpublishForm.useMutation({
    onSuccess: refreshForm,
  });

  const visibilityMutation = trpc.updateFormVisibility.useMutation({
    onSuccess: refreshForm,
  });

  // Only earlier questions can be used as logic sources.
  const currentQuestionIndex = editingQuestionId
    ? questions?.findIndex((question) => question.id === editingQuestionId) ?? -1
    : questions?.length ?? 0;

  const availableLogicQuestions = (questions ?? []).filter(
    (_, index) => index < currentQuestionIndex
  );

  const selectedLogicQuestion = availableLogicQuestions.find(
    (question) => question.id === logicQuestionId
  );

  const selectedLogicQuestionType =
    selectedLogicQuestion?.type as QuestionType | undefined;

  const logicOperators = selectedLogicQuestionType
    ? getOperators(selectedLogicQuestionType)
    : [];

  const handleLogicQuestionChange = (questionId: string) => {
    setLogicQuestionId(questionId);

    const source = availableLogicQuestions.find(
      (question) => question.id === questionId
    );

    if (!source) {
      setLogicValue("");
      return;
    }

    const sourceType = source.type as QuestionType;
    const sourceConfig = getConfig(source.config);

    setLogicOperator(
      sourceType === "checkbox" ? "contains" : "equals"
    );

    if (
      (sourceType === "select" || sourceType === "checkbox") &&
      sourceConfig.options?.length
    ) {
      setLogicValue(sourceConfig.options[0]);
    } else {
      setLogicValue("");
    }
  };

  const openCreateModal = () => {
    resetFields();
    createQuestionMutation.reset();
    updateQuestionMutation.reset();
    setIsModalOpen(true);
  };

  const openEditModal = (
    question: NonNullable<typeof questions>[number]
  ) => {
    const config = getConfig(question.config);

    setEditingQuestionId(question.id);
    setTitle(question.title);
    setDescription(question.description ?? "");
    setType(question.type as QuestionType);
    setRequired(question.required);

    setOptions(config.options ?? ["Option 1", "Option 2"]);
    setMin(String(config.min ?? 1));
    setMax(String(config.max ?? 5));

    setLogicEnabled(Boolean(config.logic));
    setLogicAction(config.logic?.action ?? "show");
    setLogicQuestionId(config.logic?.questionId ?? "");
    setLogicOperator(config.logic?.operator ?? "equals");
    setLogicValue(String(config.logic?.value ?? ""));

    createQuestionMutation.reset();
    updateQuestionMutation.reset();

    setIsModalOpen(true);
  };

  const handleTypeChange = (newType: QuestionType) => {
    setType(newType);
    setOptions(["Option 1", "Option 2"]);
    setMin("1");
    setMax("5");
  };

  const buildConfig = (): QuestionConfig => {
    const config: QuestionConfig = {};

    if (type === "select" || type === "checkbox") {
      config.options = options
        .map((option) => option.trim())
        .filter(Boolean);
    }

    if (type === "number" || type === "rating") {
      config.min = Number(min);
      config.max = Number(max);
    }

    if (logicEnabled && selectedLogicQuestion) {
      const sourceType = selectedLogicQuestion.type as QuestionType;

      config.logic = {
        action: logicAction,
        questionId: logicQuestionId,
        operator: logicOperator,
        value:
          sourceType === "number" || sourceType === "rating"
            ? Number(logicValue)
            : logicValue,
      };
    }

    return config;
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const config = buildConfig();

    if (editingQuestionId) {
      updateQuestionMutation.mutate({
        questionId: editingQuestionId,
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        required,
        config,
      });
    } else {
      createQuestionMutation.mutate({
        formId,
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        required,
        config,
      });
    }
  };

  const handleDelete = (questionId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this question?"
    );

    if (confirmed) {
      deleteQuestionMutation.mutate({ questionId });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !questions) return;

    const oldIndex = questions.findIndex(
      (question) => question.id === active.id
    );

    const newIndex = questions.findIndex(
      (question) => question.id === over.id
    );

    if (oldIndex === -1 || newIndex === -1) return;

    const updatedQuestions = arrayMove(
      [...questions],
      oldIndex,
      newIndex
    );

    reorderQuestionsMutation.mutate({
      formId,
      questionIds: updatedQuestions.map((question) => question.id),
    });
  };

  const handleCopyShareLink = async () => {
    if (!form?.slug) return;

    const shareUrl = `${window.location.origin}/forms/${form.slug}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsLinkCopied(true);
      setCopyError("");
    } catch {
      setIsLinkCopied(false);
      setCopyError("Unable to copy link. Please copy it manually.");
    }
  };

  const isSaving =
    createQuestionMutation.isPending ||
    updateQuestionMutation.isPending;

  const mutationError =
    createQuestionMutation.error?.message ||
    updateQuestionMutation.error?.message;

  const hasInvalidOptions =
    (type === "select" || type === "checkbox") &&
    options.map((option) => option.trim()).filter(Boolean).length < 2;

  const hasInvalidRange =
    (type === "number" || type === "rating") &&
    (min === "" ||
      max === "" ||
      !Number.isFinite(Number(min)) ||
      !Number.isFinite(Number(max)) ||
      Number(min) > Number(max));

  const hasInvalidLogic =
    logicEnabled &&
    (!logicQuestionId ||
      !selectedLogicQuestion ||
      !logicValue.trim() ||
      ((selectedLogicQuestionType === "number" ||
        selectedLogicQuestionType === "rating") &&
        !Number.isFinite(Number(logicValue))));

  if (isFormLoading || areQuestionsLoading) {
    return (
      <div className="p-8 text-sm text-muted">
        Loading form builder...
      </div>
    );
  }

  if (isFormError || !form) {
    return (
      <div className="p-8 text-sm text-red-600">
        Form not found.
      </div>
    );
  }

  if (areQuestionsError || !questions) {
    return (
      <div className="p-8 text-sm text-red-600">
        Failed to load questions.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="flex flex-col justify-between gap-5 border-b border-border px-6 py-6 sm:flex-row sm:items-center sm:px-10">
        <div>
          <p className="text-sm text-muted">
            FormFlow / Form Builder
          </p>

          <h1 className="mt-2 text-2xl font-semibold">
            {form.title}
          </h1>

          <p className="mt-1 text-sm text-muted">
            {form.description || "No description added."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-2 text-xs font-semibold ${
                form.status === "published"
                  ? "bg-green-50 text-green-700"
                  : "bg-cream text-foreground"
              }`}
            >
              {form.status === "published" ? "Published" : "Draft"}
            </span>

            <select
              value={form.visibility}
              disabled={visibilityMutation.isPending}
              onChange={(e) => {
                visibilityMutation.mutate({
                  formId,
                  visibility: e.target.value as "public" | "unlisted",
                });
              }}
              className="rounded-lg border border-border bg-white px-3 py-3 text-sm"
            >
              <option value="unlisted">Unlisted</option>
              <option value="public">Public</option>
            </select>

            {form.status === "published" ? (
              <button
                type="button"
                onClick={() => unpublishMutation.mutate({ formId })}
                disabled={unpublishMutation.isPending}
                className="rounded-lg border border-border px-4 py-3 text-sm font-semibold hover:bg-cream disabled:opacity-50"
              >
                {unpublishMutation.isPending
                  ? "Unpublishing..."
                  : "Unpublish"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  publishMutation.mutate({
                    formId,
                    visibility: form.visibility,
                  })
                }
                disabled={
                  publishMutation.isPending || questions.length === 0
                }
                className="rounded-lg bg-[#302E29] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#514D45] disabled:opacity-50"
              >
                {publishMutation.isPending
                  ? "Publishing..."
                  : "Publish Form"}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={openPreview}
            className="rounded-lg border border-border px-5 py-3 text-sm font-semibold transition hover:bg-cream"
          >
            <span className="mr-2">◉</span>
            Preview Form
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-[#CFC6B1] px-5 py-3 text-sm font-semibold text-[#302E29] transition hover:bg-[#B7B09E]"
          >
            + Add Question
          </button>

          <button
            type="button"
            onClick={() =>
              window.location.assign(
                `/dashboard/forms/${formId}/responses`
              )
            }
            className="rounded-lg border border-[#DED6C1] px-5 py-3 text-sm font-semibold text-[#302E29] transition hover:bg-cream"
          >
            View Responses →
          </button>
        </div>
      </header>

      {form.status === "published" && form.slug && (
        <div className="border-b border-border bg-[#FAF9F6] px-6 py-4 sm:px-10">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">
                Your form is live!
              </p>
              <p className="mt-1 text-xs text-muted">
                Share this link with respondents.
              </p>
              <p className="mt-2 break-all text-sm text-muted">
                /forms/{form.slug}
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyShareLink}
              className="shrink-0 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold hover:bg-cream"
            >
              {isLinkCopied ? "Copied!" : "Copy Link"}
            </button>
          </div>

          {copyError && (
            <p className="mx-auto mt-2 max-w-3xl text-xs text-red-600">
              {copyError}
            </p>
          )}
        </div>
      )}

      {(publishMutation.isError ||
        unpublishMutation.isError ||
        visibilityMutation.isError) && (
        <p className="px-6 pt-3 text-sm text-red-600 sm:px-10">
          {publishMutation.error?.message ||
            unpublishMutation.error?.message ||
            visibilityMutation.error?.message}
        </p>
      )}

      {/* Questions */}
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
        <div className="mb-8">
          <h2 className="text-lg font-semibold">Questions</h2>

          <p className="mt-1 text-sm text-muted">
            Create, customize and organize your form questions.
            Drag questions to change their order.
          </p>
        </div>

        <div className="mb-5 flex items-center justify-between">
          <span className="text-sm font-medium text-muted">
            {questions.length} Questions
          </span>

          {questions.length > 0 && (
            <span className="text-xs text-muted">
              Drag the handle to reorder
            </span>
          )}
        </div>

        {questions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#CFC6B1] px-6 py-16 text-center">
            <div className="text-4xl text-[#B7B09E]">+</div>

            <h3 className="mt-4 font-semibold">
              No questions yet
            </h3>

            <p className="mt-2 text-sm text-muted">
              Start building your form by adding your first question.
            </p>

            <button
              type="button"
              onClick={openCreateModal}
              className="mt-5 rounded-lg bg-[#CFC6B1] px-5 py-2.5 text-sm font-semibold transition hover:bg-[#B7B09E]"
            >
              Add your first question
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={questions.map((question) => question.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {questions.map((question, index) => {
                  const config = getConfig(question.config);
                  const sourceQuestion = questions.find(
                    (item) => item.id === config.logic?.questionId
                  );

                  const logicDescription = config.logic
                    ? `${config.logic.action === "show" ? "Show" : "Hide"} when "${sourceQuestion?.title ?? "Previous question"}" ${config.logic.operator === "equals" ? "equals" : config.logic.operator === "notEquals" ? "does not equal" : "contains"} "${config.logic.value}"`
                    : undefined;

                  return (
                    <SortableQuestionCard
                      key={question.id}
                      question={question}
                      index={index}
                      onEdit={() => openEditModal(question)}
                      onDelete={() => handleDelete(question.id)}
                      isDeleting={deleteQuestionMutation.isPending}
                      logicDescription={logicDescription}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {deleteQuestionMutation.isError && (
          <p className="mt-4 text-sm text-red-600">
            {deleteQuestionMutation.error.message}
          </p>
        )}

        {reorderQuestionsMutation.isError && (
          <p className="mt-4 text-sm text-red-600">
            {reorderQuestionsMutation.error.message}
          </p>
        )}

        {reorderQuestionsMutation.isPending && (
          <p className="mt-4 text-sm text-muted">
            Saving new question order...
          </p>
        )}
      </main>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8 backdrop-blur-[2px]">
          <div className="my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {editingQuestionId
                    ? "Edit question"
                    : "Add a question"}
                </h2>

                <p className="mt-1 text-sm text-muted">
                  Configure your question below.
                </p>
              </div>

              <button
                type="button"
                onClick={resetFields}
                className="text-2xl text-muted transition hover:text-foreground"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Question title *
                </label>

                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. What is your name?"
                  maxLength={200}
                  required
                  className="w-full rounded-lg border border-border px-4 py-3 text-sm outline-none transition focus:border-[#B7B09E]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a short description (optional)"
                  maxLength={500}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border px-4 py-3 text-sm outline-none transition focus:border-[#B7B09E]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Question type
                </label>

                <select
                  value={type}
                  onChange={(e) =>
                    handleTypeChange(e.target.value as QuestionType)
                  }
                  className="w-full rounded-lg border border-border bg-white px-4 py-3 text-sm outline-none focus:border-[#B7B09E]"
                >
                  {questionTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Options */}
              {(type === "select" || type === "checkbox") && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium">
                    Options
                  </label>

                  {options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const updated = [...options];
                          updated[index] = e.target.value;
                          setOptions(updated);
                        }}
                        placeholder={`Option ${index + 1}`}
                        className="min-w-0 flex-1 rounded-lg border border-border px-4 py-2.5 text-sm outline-none focus:border-[#B7B09E]"
                      />

                      <button
                        type="button"
                        disabled={options.length <= 2}
                        onClick={() =>
                          setOptions(
                            options.filter((_, i) => i !== index)
                          )
                        }
                        className="rounded-lg border border-border px-3 text-sm text-muted hover:bg-cream disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    disabled={options.length >= 50}
                    onClick={() =>
                      setOptions([
                        ...options,
                        `Option ${options.length + 1}`,
                      ])
                    }
                    className="text-sm font-medium text-muted hover:text-foreground disabled:opacity-40"
                  >
                    + Add option
                  </button>
                </div>
              )}

              {/* Number / Rating */}
              {(type === "number" || type === "rating") && (
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    {type === "rating" ? "Rating range" : "Number range"}
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        Minimum
                      </label>

                      <input
                        type="number"
                        value={min}
                        onChange={(e) => setMin(e.target.value)}
                        required
                        className="w-full rounded-lg border border-border px-4 py-2.5 text-sm outline-none focus:border-[#B7B09E]"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-muted">
                        Maximum
                      </label>

                      <input
                        type="number"
                        value={max}
                        onChange={(e) => setMax(e.target.value)}
                        required
                        className="w-full rounded-lg border border-border px-4 py-2.5 text-sm outline-none focus:border-[#B7B09E]"
                      />
                    </div>
                  </div>

                  {min !== "" &&
                    max !== "" &&
                    Number(min) > Number(max) && (
                      <p className="mt-2 text-xs text-red-600">
                        Minimum cannot exceed maximum.
                      </p>
                    )}
                </div>
              )}

              {/* Conditional Logic */}
              <div className="rounded-xl border border-[#DED6C1] bg-[#FAF9F6] p-4">
                <div className="flex items-start gap-3">
                  <input
                    id="enable-logic"
                    type="checkbox"
                    checked={logicEnabled}
                    onChange={(e) => {
                      setLogicEnabled(e.target.checked);
                    }}
                    disabled={availableLogicQuestions.length === 0}
                    className="mt-1 size-4 accent-[#8A7652]"
                  />

                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor="enable-logic"
                      className="cursor-pointer text-sm font-semibold"
                    >
                      Enable Conditional Logic
                    </label>

                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      Control when this question appears based on an
                      earlier answer.
                    </p>
                  </div>
                </div>

                {availableLogicQuestions.length === 0 && (
                  <p className="mt-3 text-xs text-muted">
                    Add another question before configuring conditional
                    logic. Conditions can only refer to earlier questions.
                  </p>
                )}

                {logicEnabled && availableLogicQuestions.length > 0 && (
                  <div className="mt-5 space-y-4 border-t border-[#DED6C1] pt-4">
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-muted">
                        ACTION
                      </label>

                      <select
                        value={logicAction}
                        onChange={(e) =>
                          setLogicAction(e.target.value as "show" | "hide")
                        }
                        className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm"
                      >
                        <option value="show">Show this question</option>
                        <option value="hide">Hide this question</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold text-muted">
                        WHEN THIS QUESTION
                      </label>

                      <select
                        value={logicQuestionId}
                        onChange={(e) =>
                          handleLogicQuestionChange(e.target.value)
                        }
                        required={logicEnabled}
                        className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm"
                      >
                        <option value="">Choose a previous question</option>

                        {availableLogicQuestions.map((question) => (
                          <option key={question.id} value={question.id}>
                            {question.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedLogicQuestion && (
                      <>
                        <div>
                          <label className="mb-2 block text-xs font-semibold text-muted">
                            CONDITION
                          </label>

                          <select
                            value={logicOperator}
                            onChange={(e) =>
                              setLogicOperator(
                                e.target.value as LogicOperator
                              )
                            }
                            className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm"
                          >
                            {logicOperators.map((operator) => (
                              <option
                                key={operator.value}
                                value={operator.value}
                              >
                                {operator.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold text-muted">
                            ANSWER VALUE
                          </label>

                          {(selectedLogicQuestionType === "select" ||
                            selectedLogicQuestionType === "checkbox") &&
                          getConfig(selectedLogicQuestion.config).options
                            ?.length ? (
                            <select
                              value={logicValue}
                              onChange={(e) => setLogicValue(e.target.value)}
                              required={logicEnabled}
                              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm"
                            >
                              <option value="">Choose an answer</option>

                              {getConfig(selectedLogicQuestion.config).options?.map(
                                (option, index) => (
                                  <option key={index} value={option}>
                                    {option}
                                  </option>
                                )
                              )}
                            </select>
                          ) : (
                            <input
                              type={
                                selectedLogicQuestionType === "number" ||
                                selectedLogicQuestionType === "rating"
                                  ? "number"
                                  : selectedLogicQuestionType === "date"
                                    ? "date"
                                    : "text"
                              }
                              value={logicValue}
                              onChange={(e) => setLogicValue(e.target.value)}
                              placeholder="Enter the answer to match"
                              required={logicEnabled}
                              className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-[#B7B09E]"
                            />
                          )}
                        </div>
                      </>
                    )}

                    <p className="rounded-lg bg-white p-3 text-xs leading-relaxed text-muted">
                      This question will{" "}
                      <strong>
                        {logicAction === "show" ? "appear" : "be hidden"}
                      </strong>{" "}
                      when the selected previous question matches your
                      condition.
                    </p>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                  className="size-4 accent-[#B7B09E]"
                />
                Make this question required
              </label>

              {mutationError && (
                <p className="text-sm text-red-600">
                  {mutationError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetFields}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-cream"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    isSaving ||
                    !title.trim() ||
                    hasInvalidOptions ||
                    hasInvalidRange ||
                    hasInvalidLogic
                  }
                  className="rounded-lg bg-[#CFC6B1] px-5 py-2.5 text-sm font-semibold text-[#302E29] transition hover:bg-[#B7B09E] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving
                    ? "Saving..."
                    : editingQuestionId
                      ? "Update Question"
                      : "Add Question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Form Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/40 px-3 py-6 backdrop-blur-[2px] sm:px-6">
          <div className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-[#FAF9F6] shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-white px-5 py-4 sm:px-8">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">
                  FormFlow Preview
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  Respondent view
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                aria-label="Close preview"
                className="flex size-9 items-center justify-center rounded-lg text-xl text-muted transition hover:bg-cream hover:text-foreground"
              >
                ×
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-5 py-8 sm:px-10 sm:py-10">
              <div className="mb-8 border-b border-border pb-6">
                <h1 className="text-2xl font-semibold">
                  {form.title}
                </h1>

                {form.description && (
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {form.description}
                  </p>
                )}
              </div>

              {questions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#CFC6B1] p-8 text-center">
                  <p className="font-medium">
                    Your form has no questions yet.
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Add questions to see them in the preview.
                  </p>
                </div>
              ) : visiblePreviewQuestions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#CFC6B1] p-8 text-center">
                  <p className="text-sm text-muted">
                    No questions are currently visible.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {visiblePreviewQuestions.map((question, index) => (
                    <QuestionPreview
                      key={question.id}
                      question={question}
                      index={index}
                      answer={previewAnswers[question.id]}
                      onChange={(value) =>
                        handlePreviewAnswerChange(question.id, value)
                      }
                    />
                  ))}
                </div>
              )}

              <div className="mt-10 border-t border-border pt-6">
                <button
                  type="button"
                  disabled
                  className="rounded-lg bg-[#CFC6B1] px-6 py-3 text-sm font-semibold text-[#302E29] opacity-70"
                >
                  Submit (Preview only)
                </button>

                <p className="mt-3 text-xs text-muted">
                  Interactive preview: enter answers to test conditional
                  questions. Responses cannot be submitted or saved.
                </p>
              </div>
            </div>

            <div className="flex justify-end border-t border-border bg-white px-5 py-4 sm:px-8">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium transition hover:bg-cream"
              >
                Back to editor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
