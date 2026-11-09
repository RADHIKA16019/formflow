
import { and, count, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { db } from "../../db/index.js";
import { forms, questions, responses } from "../../db/schema.js";
import { protectedProcedure, publicProcedure, t } from "../trpc.js";

export const responsesRouter = t.router({
  getTotalResponses: protectedProcedure.query(async ({ ctx }) => {
    const [result] = await db
      .select({
        total: count(responses.id),
      })
      .from(responses)
      .innerJoin(forms, eq(responses.formId, forms.id))
      .where(eq(forms.ownerId, ctx.session.user.id));

    return result.total;
  }),

  getFormResponses: protectedProcedure
    .input(z.object({ formId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [form] = await db
        .select({ id: forms.id })
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
          message: "Form not found or you don't have access to it.",
        });
      }

      return db
        .select({
          id: responses.id,
          respondentEmail: responses.respondentEmail,
          answers: responses.answers,
          submittedAt: responses.submittedAt,
        })
        .from(responses)
        .where(eq(responses.formId, input.formId))
        .orderBy(desc(responses.submittedAt));
    }),

  deleteResponse: protectedProcedure
    .input(z.object({ responseId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deletedResponse] = await db
        .delete(responses)
        .where(
          and(
            eq(responses.id, input.responseId),
            sql`EXISTS (
              SELECT 1
              FROM forms
              WHERE forms.id = ${responses.formId}
              AND forms.owner_id = ${ctx.session.user.id}
            )`
          )
        )
        .returning({ id: responses.id });

      if (!deletedResponse) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Response not found or you don't have access to it.",
        });
      }

      return {
        success: true,
        message: "Response deleted successfully!",
      };
    }),

  submitPublicResponse: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(100),
        answers: z.record(
          z.string(),
          z.union([
            z.string(),
            z.number(),
            z.array(z.string()),
          ])
        ),
      })
    )
    .mutation(async ({ input }) => {
      const [form] = await db
        .select({ id: forms.id })
        .from(forms)
        .where(
          and(
            eq(forms.slug, input.slug),
            eq(forms.status, "published")
          )
        )
        .limit(1);

      if (!form) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This form is unavailable or has not been published.",
        });
      }

      const formQuestions = await db
        .select()
        .from(questions)
        .where(eq(questions.formId, form.id));

      const questionIds = new Set(
        formQuestions.map((question) => question.id)
      );

      for (const questionId of Object.keys(input.answers)) {
        if (!questionIds.has(questionId)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid question found in submitted answers.",
          });
        }
      }

      for (const question of formQuestions) {
        const answer = input.answers[question.id];

        if (question.required) {
          const isEmpty =
            answer === undefined ||
            answer === "" ||
            (Array.isArray(answer) && answer.length === 0);

          if (isEmpty) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Please answer: ${question.title}`,
            });
          }
        }

        if (answer === undefined || answer === "") {
          continue;
        }

        const config = question.config as {
          options?: string[];
          min?: number;
          max?: number;
        } | null;

        if (
          ["text", "email", "date", "select"].includes(question.type) &&
          typeof answer !== "string"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid answer for: ${question.title}`,
          });
        }

        if (
          question.type === "email" &&
          typeof answer === "string" &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Please enter a valid email address.",
          });
        }

        if (
          question.type === "number" &&
          typeof answer !== "string" &&
          typeof answer !== "number"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid number for: ${question.title}`,
          });
        }

        if (question.type === "number") {
          const value = Number(answer);

          if (!Number.isFinite(value)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Invalid number for: ${question.title}`,
            });
          }

          if (
            (config?.min !== undefined && value < config.min) ||
            (config?.max !== undefined && value > config.max)
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Number is outside the allowed range for: ${question.title}`,
            });
          }
        }

        if (
          question.type === "select" &&
          config?.options &&
          !config.options.includes(answer as string)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid option for: ${question.title}`,
          });
        }

        if (question.type === "checkbox") {
          if (
            !Array.isArray(answer) ||
            !answer.every(
              (option) =>
                typeof option === "string" &&
                (config?.options ?? []).includes(option)
            )
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Invalid options for: ${question.title}`,
            });
          }
        }

        if (
          question.type === "rating" &&
          (typeof answer !== "number" || answer < 1 || answer > 5)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid rating for: ${question.title}`,
          });
        }
      }

      const emailQuestion = formQuestions.find(
        (question) => question.type === "email"
      );

      const respondentEmail = emailQuestion
        ? input.answers[emailQuestion.id]
        : null;

      await db.transaction(async (tx) => {
        const [lockedForm] = await tx
          .select({
            id: forms.id,
            status: forms.status,
            expiresAt: forms.expiresAt,
            responseLimit: forms.responseLimit,
          })
          .from(forms)
          .where(eq(forms.id, form.id))
          .for("update")
          .limit(1);

        if (!lockedForm || lockedForm.status !== "published") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "This form is no longer available.",
          });
        }

        if (
          lockedForm.expiresAt &&
          lockedForm.expiresAt.getTime() <= Date.now()
        ) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "This form has expired and is no longer accepting responses.",
          });
        }

        const [currentCount] = await tx
          .select({ total: count() })
          .from(responses)
          .where(eq(responses.formId, lockedForm.id));

        if (
          lockedForm.responseLimit !== null &&
          Number(currentCount.total) >= lockedForm.responseLimit
        ) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "This form has reached its maximum response limit.",
          });
        }

        await tx.insert(responses).values({
          formId: lockedForm.id,
          respondentEmail:
            typeof respondentEmail === "string"
              ? respondentEmail
              : null,
          answers: input.answers,
        });
      });

      return {
        success: true,
        message: "Your response has been submitted successfully.",
      };
    }),
});
