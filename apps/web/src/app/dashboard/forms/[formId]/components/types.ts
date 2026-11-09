
export const questionTypes = [
  { label: "Short Text", value: "text" },
  { label: "Email", value: "email" },
  { label: "Number", value: "number" },
  { label: "Dropdown", value: "select" },
  { label: "Checkbox", value: "checkbox" },
  { label: "Rating", value: "rating" },
  { label: "Date", value: "date" },
] as const;

export type QuestionType = (typeof questionTypes)[number]["value"];

export type LogicOperator = "equals" | "notEquals" | "contains";

export type QuestionLogic = {
  action: "show" | "hide";
  questionId: string;
  operator: LogicOperator;
  value: string | number;
};

export type QuestionConfig = {
  options?: string[];
  min?: number;
  max?: number;
  logic?: QuestionLogic;
};

export type QuestionCardData = {
  id: string;
  title: string;
  description: string | null;
  type: QuestionType;
  required: boolean;
  position: number;
  pageNumber: number;
  config?: unknown;
};

export type AnswerValue = string | number | string[];

export type PreviewAnswers = Record<string, AnswerValue>;
