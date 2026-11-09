
"use client";

import {
  useSortable,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import type {
  QuestionCardData,
} from "./types";

import { getConfig } from "./helpers";

type PageOption = {
  id: string;
  pageNumber: number;
  title: string;
};

type SortableQuestionCardProps = {
  question: QuestionCardData;
  index: number;
  pages: PageOption[];
  onEdit: () => void;
  onDelete: () => void;
  onMove: (pageNumber: number) => void;
  isDeleting: boolean;
  isMoving: boolean;
  logicDescription?: string;
};

export default function SortableQuestionCard({
  question,
  index,
  pages,
  onEdit,
  onDelete,
  onMove,
  isDeleting,
  isMoving,
  logicDescription,
}: SortableQuestionCardProps) {
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
        className="absolute left-4 top-1/2 flex size-9 -translate-y-1/2 touch-none cursor-grab items-center justify-center rounded-lg border border-border bg-white text-xl text-muted transition hover:border-[#B7B09E] hover:bg-cream active:cursor-grabbing"
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

      {(question.type === "select" ||
        question.type === "checkbox") && (
        <div className="mt-4 space-y-2">
          {config.options?.map((option, i) => (
            <p
              key={i}
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

      {(question.type === "number" ||
        question.type === "rating") && (
        <p className="mt-3 text-xs text-muted">
          Range: {config.min ?? "No minimum"} –{" "}
          {config.max ?? "No maximum"}
        </p>
      )}

      {config.logic && (
        <div className="mt-4 rounded-lg border border-[#DED6C1] bg-[#FAF9F6] p-3">
          <p className="text-xs font-semibold text-[#766747]">
            ↳ CONDITIONAL LOGIC
          </p>

          <p className="mt-1 text-sm text-foreground">
            {logicDescription ??
              `${config.logic.action === "show" ? "Show" : "Hide"} when condition matches`}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span
          className={`text-xs font-medium ${
            question.required ? "text-[#8A7652]" : "text-muted"
          }`}
        >
          {question.required ? "Required" : "Optional"}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {pages.length > 1 && (
            <select
              value={question.pageNumber}
              disabled={isMoving}
              onChange={(e) => onMove(Number(e.target.value))}
              aria-label="Move question to page"
              className="max-w-36 rounded-lg border border-border bg-white px-2 py-2 text-xs disabled:opacity-50"
            >
              {pages.map((page) => (
                <option
                  key={page.id}
                  value={page.pageNumber}
                >
                  Move to: {page.title}
                </option>
              ))}
            </select>
          )}

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
