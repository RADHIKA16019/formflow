
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { db } from "../../db/index.js";
import { forms, questions, responses } from "../../db/schema.js";
import { protectedProcedure, t } from "../trpc.js";

const analyticsDaysSchema = z.enum(["7", "30", "90"]).default("30");

function getQuestionOptions(config: unknown): string[] {
  if (
    !config ||
    typeof config !== "object" ||
    !("options" in config) ||
    !Array.isArray(config.options)
  ) {
    return [];
  }

  return config.options.filter(
    (option): option is string => typeof option === "string"
  );
}

function isAnswered(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

export const analyticsRouter = t.router({
  // Dashboard-wide response analytics
  getResponseAnalytics: protectedProcedure
    .input(
      z
        .object({
          days: analyticsDaysSchema,
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const days = Number(input?.days ?? "30");

      const startDate = new Date(
        Date.now() - days * 24 * 60 * 60 * 1000
      );

      return db
        .select({
          date: sql<string>`
            TO_CHAR(
              DATE(${responses.submittedAt} + INTERVAL '5 hours 30 minutes'),
              'YYYY-MM-DD'
            )
          `,
          responses: count(responses.id),
        })
        .from(responses)
        .innerJoin(forms, eq(responses.formId, forms.id))
        .where(
          and(
            eq(forms.ownerId, ctx.session.user.id),
            gte(responses.submittedAt, startDate)
          )
        )
        .groupBy(
          sql`DATE(${responses.submittedAt} + INTERVAL '5 hours 30 minutes')`
        )
        .orderBy(
          sql`DATE(${responses.submittedAt} + INTERVAL '5 hours 30 minutes')`
        );
    }),

  // Individual form analytics
  getFormAnalytics: protectedProcedure
    .input(
      z.object({
        formId: z.string().uuid(),
        days: analyticsDaysSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify form ownership
      const [form] = await db
        .select({
          id: forms.id,
          title: forms.title,
          status: forms.status,
        })
        .from(forms)
        .where(
          and(
            eq(forms.id, input.formId),
            eq(forms.ownerId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!form) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found.",
        });
      }

      // All-time response count
      const [responseCount] = await db
        .select({
          total: count(responses.id),
        })
        .from(responses)
        .where(eq(responses.formId, input.formId));

      // Latest response
      const [latestResponse] = await db
        .select({
          submittedAt: responses.submittedAt,
        })
        .from(responses)
        .where(eq(responses.formId, input.formId))
        .orderBy(desc(responses.submittedAt))
        .limit(1);

      // Date range for the chart
      const startDate = new Date(
        Date.now() -
          Number(input.days) * 24 * 60 * 60 * 1000
      );

      // Daily responses within selected period
      const dailyResponses = await db
        .select({
          date: sql<string>`
            TO_CHAR(
              DATE(${responses.submittedAt} + INTERVAL '5 hours 30 minutes'),
              'YYYY-MM-DD'
            )
          `,
          responses: count(responses.id),
        })
        .from(responses)
        .where(
          and(
            eq(responses.formId, input.formId),
            gte(responses.submittedAt, startDate)
          )
        )
        .groupBy(
          sql`DATE(${responses.submittedAt} + INTERVAL '5 hours 30 minutes')`
        )
        .orderBy(
          sql`DATE(${responses.submittedAt} + INTERVAL '5 hours 30 minutes')`
        );

      return {
        form,
        totalResponses: Number(responseCount.total),
        latestResponseAt: latestResponse?.submittedAt ?? null,
        dailyResponses,
      };
    }),

  // Question-wise analytics for an individual form
  getQuestionWiseAnalytics: protectedProcedure
    .input(
      z.object({
        formId: z.string().uuid(),
        days: analyticsDaysSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify form ownership
      const [form] = await db
        .select({
          id: forms.id,
        })
        .from(forms)
        .where(
          and(
            eq(forms.id, input.formId),
            eq(forms.ownerId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!form) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found.",
        });
      }

      const startDate = new Date(
        Date.now() -
          Number(input.days) * 24 * 60 * 60 * 1000
      );

      // Fetch questions in their original order
      const formQuestions = await db
        .select({
          id: questions.id,
          title: questions.title,
          type: questions.type,
          config: questions.config,
          position: questions.position,
        })
        .from(questions)
        .where(eq(questions.formId, input.formId))
        .orderBy(questions.position);

      // Fetch responses within the selected period
      const formResponses = await db
        .select({
          id: responses.id,
          answers: responses.answers,
          submittedAt: responses.submittedAt,
        })
        .from(responses)
        .where(
          and(
            eq(responses.formId, input.formId),
            gte(responses.submittedAt, startDate)
          )
        )
        .orderBy(desc(responses.submittedAt));

      const questionAnalytics = formQuestions.map((question) => {
        const optionCounts: Record<string, number> = {};
        const ratingDistribution: Record<string, number> = {
          "1": 0,
          "2": 0,
          "3": 0,
          "4": 0,
          "5": 0,
        };

        const options = getQuestionOptions(question.config);

        for (const option of options) {
          optionCounts[option] = 0;
        }

        const textAnswers: Array<{
          responseId: string;
          value: string;
          submittedAt: Date;
        }> = [];

        const numberValues: number[] = [];
        const ratingValues: number[] = [];

        let totalAnswers = 0;

        for (const response of formResponses) {
          const answers = response.answers as
            | Record<string, unknown>
            | null;

          if (
            !answers ||
            typeof answers !== "object" ||
            Array.isArray(answers)
          ) {
            continue;
          }

          const answer = answers[question.id];

          if (!isAnswered(answer)) {
            continue;
          }

          totalAnswers += 1;

          if (question.type === "select") {
            if (typeof answer === "string") {
              optionCounts[answer] = (optionCounts[answer] ?? 0) + 1;
            }
          } else if (question.type === "checkbox") {
            if (Array.isArray(answer)) {
              for (const selectedOption of answer) {
                if (typeof selectedOption === "string") {
                  optionCounts[selectedOption] =
                    (optionCounts[selectedOption] ?? 0) + 1;
                }
              }
            }
          } else if (question.type === "rating") {
            const rating = Number(answer);

            if (
              Number.isFinite(rating) &&
              rating >= 1 &&
              rating <= 5
            ) {
              const normalizedRating = Math.round(rating);

              ratingValues.push(normalizedRating);

              ratingDistribution[String(normalizedRating)] += 1;
            }
          } else if (question.type === "number") {
            const numericValue = Number(answer);

            if (Number.isFinite(numericValue)) {
              numberValues.push(numericValue);
            }
          } else {
            const value = Array.isArray(answer)
              ? answer.join(", ")
              : String(answer);

            textAnswers.push({
              responseId: response.id,
              value,
              submittedAt: response.submittedAt,
            });
          }
        }

        const average = (values: number[]) =>
          values.length > 0
            ? Number(
                (
                  values.reduce((sum, value) => sum + value, 0) /
                  values.length
                ).toFixed(2)
              )
            : null;

        return {
          id: question.id,
          title: question.title,
          type: question.type,
          position: question.position,

          totalAnswers,

          optionCounts: Object.entries(optionCounts).map(
            ([option, responses]) => ({
              option,
              responses,
            })
          ),

          ratingDistribution: Object.entries(ratingDistribution).map(
            ([rating, responses]) => ({
              rating: Number(rating),
              responses,
            })
          ),

          averageRating: average(ratingValues),

          numberStats: {
            minimum:
              numberValues.length > 0
                ? Math.min(...numberValues)
                : null,
            maximum:
              numberValues.length > 0
                ? Math.max(...numberValues)
                : null,
            average: average(numberValues),
          },

          textAnswers,
        };
      });

      return {
        totalResponses: formResponses.length,
        questions: questionAnalytics,
      };
    }),
});
