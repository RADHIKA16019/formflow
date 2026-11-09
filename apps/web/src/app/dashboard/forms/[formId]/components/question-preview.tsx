
"use client";

import type {
  QuestionCardData,
  AnswerValue,
} from "./types";

import { getConfig } from "./helpers";

type QuestionPreviewProps = {
  question: QuestionCardData;
  index: number;
  answer: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
};

export default function QuestionPreview({
  question,
  index,
  answer,
  onChange,
}: QuestionPreviewProps) {
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
          placeholder="Enter a number"
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
                    const current = Array.isArray(answer) ? answer : [];

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
          ).map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => onChange(value)}
              className={`flex size-10 items-center justify-center rounded-lg border text-sm font-medium transition ${
                Number(answer) === value
                  ? "border-[#8A7652] bg-[#DED6C1] text-[#302E29]"
                  : "border-border bg-white text-muted hover:border-[#B7B09E] hover:bg-cream"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
