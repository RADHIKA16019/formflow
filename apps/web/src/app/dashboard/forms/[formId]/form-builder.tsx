
"use client";

import { useState, type FormEvent } from "react";
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

// Available question types
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

type QuestionConfig = {
  options?: string[];
  min?: number;
  max?: number;
};

// Question card with drag-and-drop support
function SortableQuestionCard({
  question,
  index,
  onEdit,
  onDelete,
  isDeleting,
}: {
  question: {
    id: string;
    title: string;
    description: string | null;
    type: QuestionType;
    required: boolean;
    config?: unknown;
  };
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: question.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 10 : 0,
  };

  const config = (question.config ?? {}) as QuestionConfig;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-border bg-white p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder question"
            title="Drag to reorder"
            className="cursor-grab touch-none rounded-md border border-border px-2 py-1 text-lg text-muted hover:bg-cream active:cursor-grabbing"
          >
            ⠿
          </button>

          <p className="text-xs font-medium text-muted">
            QUESTION {index + 1}
          </p>
        </div>

        <span className="rounded-md bg-cream px-2 py-1 text-xs capitalize">
          {question.type}
        </span>
      </div>

      <h3 className="mt-3 font-medium">
        {question.title}
      </h3>

      {question.description && (
        <p className="mt-1 text-sm text-muted">
          {question.description}
        </p>
      )}

      {(question.type === "select" ||
        question.type === "checkbox") && (
        <div className="mt-3 space-y-2">
          {config.options?.map((option, optionIndex) => (
            <p
              key={optionIndex}
              className="text-sm text-muted"
            >
              {question.type === "checkbox" ? "☐" : "○"}{" "}
              {option}
            </p>
          ))}
        </div>
      )}

      {(question.type === "number" ||
        question.type === "rating") && (
        <p className="mt-3 text-xs text-muted">
          Range: {config.min ?? "No minimum"} –{" "}
          {config.max ?? "No maximum"}
        </p>
      )}

      <p className="mt-3 text-xs text-muted">
        {question.required ? "Required" : "Optional"}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-cream"
        >
          Edit
        </button>

        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function FormBuilder() {
  const params = useParams<{ formId: string }>();
  const formId = params.formId;

  // Modal and form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] =
    useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<QuestionType>("text");
  const [required, setRequired] = useState(false);

  const [options, setOptions] = useState([
    "Option 1",
    "Option 2",
  ]);

  const [min, setMin] = useState("1");
  const [max, setMax] = useState("5");

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch form
  const {
    data: form,
    isLoading: isFormLoading,
    isError: isFormError,
  } = trpc.getFormById.useQuery({ formId });

  // Fetch questions
  const {
    data: questions,
    isLoading: areQuestionsLoading,
    isError: areQuestionsError,
  } = trpc.getQuestionsByForm.useQuery({ formId });

  const utils = trpc.useUtils();

  // Refresh questions
  const refreshQuestions = async () => {
    await utils.getQuestionsByForm.invalidate({ formId });
  };

  // Reset modal fields
  const resetFields = () => {
    setTitle("");
    setDescription("");
    setType("text");
    setRequired(false);
    setOptions(["Option 1", "Option 2"]);
    setMin("1");
    setMax("5");
    setEditingQuestionId(null);
    setIsModalOpen(false);
  };

  // Create question
  const createQuestionMutation = trpc.createQuestion.useMutation({
    onSuccess: async () => {
      await refreshQuestions();
      resetFields();
    },
  });

  // Update question
  const updateQuestionMutation = trpc.updateQuestion.useMutation({
    onSuccess: async () => {
      await refreshQuestions();
      resetFields();
    },
  });

  // Delete question
  const deleteQuestionMutation = trpc.deleteQuestion.useMutation({
    onSuccess: refreshQuestions,
  });

  // Reorder questions
  const reorderQuestionsMutation = trpc.reorderQuestions.useMutation({
    onSuccess: refreshQuestions,
  });

  // Open modal for new question
  const openCreateModal = () => {
    resetFields();

    createQuestionMutation.reset();
    updateQuestionMutation.reset();

    setIsModalOpen(true);
  };

  // Open modal for editing
  const openEditModal = (
    question: NonNullable<typeof questions>[number]
  ) => {
    const config = (question.config ?? {}) as QuestionConfig;

    setEditingQuestionId(question.id);
    setTitle(question.title);
    setDescription(question.description ?? "");
    setType(question.type as QuestionType);
    setRequired(question.required);

    setOptions(config.options ?? ["Option 1", "Option 2"]);
    setMin(String(config.min ?? 1));
    setMax(String(config.max ?? 5));

    createQuestionMutation.reset();
    updateQuestionMutation.reset();

    setIsModalOpen(true);
  };

  // Change question type
  const handleTypeChange = (newType: QuestionType) => {
    setType(newType);
    setOptions(["Option 1", "Option 2"]);
    setMin("1");
    setMax("5");
  };

  // Build configuration
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

    return config;
  };

  // Create or update question
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

  // Delete question
  const handleDelete = (questionId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this question?"
    );

    if (confirmed) {
      deleteQuestionMutation.mutate({ questionId });
    }
  };

  // Drag-and-drop reorder
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !questions) {
      return;
    }

    const oldIndex = questions.findIndex(
      (question) => question.id === active.id
    );

    const newIndex = questions.findIndex(
      (question) => question.id === over.id
    );

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const updatedQuestions = arrayMove(
      [...questions],
      oldIndex,
      newIndex
    );

    reorderQuestionsMutation.mutate({
      formId,
      questionIds: updatedQuestions.map(
        (question) => question.id
      ),
    });
  };

  const isSaving =
    createQuestionMutation.isPending ||
    updateQuestionMutation.isPending;

  const mutationError =
    createQuestionMutation.error?.message ||
    updateQuestionMutation.error?.message;

  // Loading
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
      <header className="flex flex-col justify-between gap-4 border-b border-border px-6 py-6 sm:flex-row sm:items-center sm:px-10">
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

        <button
          onClick={openCreateModal}
          className="w-fit rounded-lg bg-[#CFC6B1] px-5 py-3 text-sm font-semibold text-[#302E29] transition hover:bg-[#B7B09E]"
        >
          + Add Question
        </button>
      </header>

      {/* Questions */}
      <main className="mx-auto max-w-3xl px-6 py-10">

        <div className="mb-8">
          <h2 className="text-lg font-semibold">
            Questions
          </h2>

          <p className="mt-1 text-sm text-muted">
            Create and manage your form questions.
          </p>
        </div>

        <div className="mb-5 text-sm text-muted">
          {questions.length} Questions
        </div>

        {questions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#CFC6B1] px-6 py-16 text-center">
            <div className="text-3xl">+</div>

            <h3 className="mt-4 font-semibold">
              No questions yet
            </h3>

            <p className="mt-2 text-sm text-muted">
              Start building your form by adding your first question.
            </p>

            <button
              onClick={openCreateModal}
              className="mt-5 rounded-lg bg-[#CFC6B1] px-5 py-2.5 text-sm font-semibold hover:bg-[#B7B09E]"
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
                {questions.map((question, index) => (
                  <SortableQuestionCard
                    key={question.id}
                    question={question}
                    index={index}
                    onEdit={() => openEditModal(question)}
                    onDelete={() => handleDelete(question.id)}
                    isDeleting={deleteQuestionMutation.isPending}
                  />
                ))}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/30 px-4 py-8">

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
                className="text-xl text-muted hover:text-foreground"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Title */}
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
                  className="w-full rounded-lg border border-border px-4 py-3 text-sm outline-none focus:border-[#B7B09E]"
                />
              </div>

              {/* Description */}
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
                  className="w-full resize-none rounded-lg border border-border px-4 py-3 text-sm outline-none focus:border-[#B7B09E]"
                />
              </div>

              {/* Type */}
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Question type
                </label>

                <select
                  value={type}
                  onChange={(e) =>
                    handleTypeChange(
                      e.target.value as QuestionType
                    )
                  }
                  className="w-full rounded-lg border border-border bg-white px-4 py-3 text-sm outline-none focus:border-[#B7B09E]"
                >
                  {questionTypes.map((item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
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

              {/* Number / Rating Range */}
              {(type === "number" || type === "rating") && (
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    {type === "rating"
                      ? "Rating range"
                      : "Number range"}
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

              {/* Required */}
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                  className="size-4 accent-[#B7B09E]"
                />

                Make this question required
              </label>

              {/* Error */}
              {mutationError && (
                <p className="text-sm text-red-600">
                  {mutationError}
                </p>
              )}

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetFields}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-cream"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    isSaving ||
                    !title.trim() ||
                    ((type === "select" || type === "checkbox") &&
                      options.filter((option) => option.trim()).length < 2) ||
                    ((type === "number" || type === "rating") &&
                      (min === "" ||
                        max === "" ||
                        !Number.isFinite(Number(min)) ||
                        !Number.isFinite(Number(max)) ||
                        Number(min) > Number(max)))
                  }
                  className="rounded-lg bg-[#CFC6B1] px-5 py-2.5 text-sm font-semibold text-[#302E29] hover:bg-[#B7B09E] disabled:cursor-not-allowed disabled:opacity-50"
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
    </div>
  );
}
