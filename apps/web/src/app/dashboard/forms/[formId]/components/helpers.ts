
import type {
  QuestionCardData,
  QuestionConfig,
  QuestionType,
  LogicOperator,
  AnswerValue,
  PreviewAnswers,
  QuestionLogic,
} from "./types";

export function getConfig(value: unknown): QuestionConfig {
  if (!value || typeof value !== "object") return {};
  return value as QuestionConfig;
}

export function getOperators(sourceType: QuestionType): {
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

export function matchesCondition(
  sourceQuestion: QuestionCardData,
  answer: AnswerValue | undefined,
  logic: QuestionLogic
): boolean {
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

export function calculateVisibleQuestions(
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

    const sourceIsVisible = visibleQuestions.some(
      (item) => item.id === logic.questionId
    );

    const matches = sourceIsVisible
      ? matchesCondition(sourceQuestion, answers[logic.questionId], logic)
      : false;

    const shouldShow =
      logic.action === "show" ? matches : !matches;

    if (shouldShow) visibleQuestions.push(question);
  }

  return visibleQuestions;
}
