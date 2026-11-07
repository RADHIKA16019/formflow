
import { initTRPC, TRPCError } from "@trpc/server";
import {
  and,
  eq,
  desc,
  asc,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { db } from "../db/index.js";
import { forms, questions } from "../db/schema.js";
import type { Context } from "./context.js";

// --------------------------------------------------
// TRPC INITIALIZATION
// --------------------------------------------------

const t = initTRPC.context<Context>().create();

const publicProcedure = t.procedure;

const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in.",
    });
  }

  return next({
    ctx: { session: ctx.session },
  });
});

// --------------------------------------------------
// VALIDATION SCHEMAS
// --------------------------------------------------

const questionTypeSchema = z.enum([
  "text",
  "email",
  "number",
  "select",
  "checkbox",
  "rating",
  "date",
]);

const formIdSchema = z.object({
  formId: z.string().uuid(),
});

const questionConfigSchema = z.object({
  options: z.array(
    z.string().trim().min(1).max(100)
  ).max(50).optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
});

const questionIdSchema = z.object({
  questionId: z.string().uuid(),
});

const questionInputSchema = z.object({
  formId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  type: questionTypeSchema,
  required: z.boolean().default(false),
  config: questionConfigSchema.optional(),
});

// --------------------------------------------------
// QUESTION CONFIG VALIDATION
// --------------------------------------------------

function validateQuestionConfig(
  type: z.infer<typeof questionTypeSchema>,
  config: z.infer<typeof questionConfigSchema>
) {
  if (
    config.min !== undefined &&
    config.max !== undefined &&
    config.min > config.max
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Minimum value cannot exceed maximum value.",
    });
  }

  if (
    (type === "select" || type === "checkbox") &&
    (!config.options || config.options.length < 2)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "At least two options are required.",
    });
  }

  if (
    type !== "select" &&
    type !== "checkbox" &&
    config.options !== undefined
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Options are only supported for choice questions.",
    });
  }

  if (
    type !== "number" &&
    type !== "rating" &&
    (config.min !== undefined || config.max !== undefined)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Minimum and maximum are only supported for number and rating questions.",
    });
  }
}

// --------------------------------------------------
// APP ROUTER
// --------------------------------------------------

export const appRouter = t.router({

  // ----------------------------------------------
  // GENERAL
  // ----------------------------------------------

  hello: publicProcedure.query(() => ({
    message: "Hello from FormFlow tRPC!",
  })),

  dbHealth: publicProcedure.query(async () => {
    await db.execute(sql`SELECT 1`);

    return {
      message: "FormFlow database connected successfully!",
    };
  }),

  getProfile: protectedProcedure.query(({ ctx }) => ({
    message: "Authenticated successfully!",
    user: ctx.session.user,
  })),

  // ----------------------------------------------
  // FORMS
  // ----------------------------------------------

  createForm: protectedProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(100),
        description: z.string().trim().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [newForm] = await db
        .insert(forms)
        .values({
          ownerId: ctx.session.user.id,
          title: input.title,
          description: input.description,
        })
        .returning();

      return {
        message: "Form created successfully!",
        form: newForm,
      };
    }),

  getMyForms: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(forms)
      .where(eq(forms.ownerId, ctx.session.user.id))
      .orderBy(desc(forms.createdAt));
  }),

  getFormById: protectedProcedure
    .input(formIdSchema)
    .query(async ({ ctx, input }) => {
      const [form] = await db
        .select()
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

      return form;
    }),

  updateForm: protectedProcedure
    .input(
      z.object({
        formId: z.string().uuid(),
        title: z.string().trim().min(1).max(100),
        description: z.string().trim().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updatedForm] = await db
        .update(forms)
        .set({
          title: input.title,
          description: input.description,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(forms.id, input.formId),
            eq(forms.ownerId, ctx.session.user.id)
          )
        )
        .returning();

      if (!updatedForm) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found.",
        });
      }

      return {
        message: "Form updated successfully!",
        form: updatedForm,
      };
    }),

  deleteForm: protectedProcedure
    .input(formIdSchema)
    .mutation(async ({ ctx, input }) => {
      const [deletedForm] = await db
        .delete(forms)
        .where(
          and(
            eq(forms.id, input.formId),
            eq(forms.ownerId, ctx.session.user.id)
          )
        )
        .returning({ id: forms.id });

      if (!deletedForm) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found.",
        });
      }

      return {
        message: "Form deleted successfully!",
      };
    }),

  // ----------------------------------------------
  // QUESTIONS - READ
  // ----------------------------------------------

  getQuestionsByForm: protectedProcedure
    .input(formIdSchema)
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
          message: "Form not found.",
        });
      }

      return db
        .select()
        .from(questions)
        .where(eq(questions.formId, input.formId))
        .orderBy(asc(questions.position));
    }),

  // ----------------------------------------------
  // QUESTIONS - CREATE
  // ----------------------------------------------

  createQuestion: protectedProcedure
    .input(questionInputSchema)
    .mutation(async ({ ctx, input }) => {
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
          message: "Form not found.",
        });
      }

      const config = input.config ?? {};

      validateQuestionConfig(input.type, config);

      const [lastQuestion] = await db
        .select({ position: questions.position })
        .from(questions)
        .where(eq(questions.formId, input.formId))
        .orderBy(desc(questions.position))
        .limit(1);

      const nextPosition = lastQuestion
        ? lastQuestion.position + 1
        : 1;

      const [newQuestion] = await db
        .insert(questions)
        .values({
          formId: input.formId,
          title: input.title,
          description: input.description,
          type: input.type,
          required: input.required,
          position: nextPosition,
          config,
        })
        .returning();

      return {
        message: "Question created successfully!",
        question: newQuestion,
      };
    }),

  // ----------------------------------------------
  // QUESTIONS - UPDATE
  // ----------------------------------------------

  updateQuestion: protectedProcedure
    .input(
      questionIdSchema.extend({
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(500).optional(),
        type: questionTypeSchema,
        required: z.boolean(),
        config: questionConfigSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existingQuestion] = await db
        .select({ id: questions.id })
        .from(questions)
        .innerJoin(forms, eq(questions.formId, forms.id))
        .where(
          and(
            eq(questions.id, input.questionId),
            eq(forms.ownerId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!existingQuestion) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Question not found.",
        });
      }

      validateQuestionConfig(input.type, input.config);

      const [updatedQuestion] = await db
        .update(questions)
        .set({
          title: input.title,
          description: input.description,
          type: input.type,
          required: input.required,
          config: input.config,
        })
        .where(eq(questions.id, input.questionId))
        .returning();

      return {
        message: "Question updated successfully!",
        question: updatedQuestion,
      };
    }),

  // ----------------------------------------------
  // QUESTIONS - DELETE
  // ----------------------------------------------

  deleteQuestion: protectedProcedure
    .input(questionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const [deletedQuestion] = await db
        .delete(questions)
        .where(
          and(
            eq(questions.id, input.questionId),
            sql`EXISTS (
              SELECT 1 FROM forms
              WHERE forms.id = ${questions.formId}
              AND forms.owner_id = ${ctx.session.user.id}
            )`
          )
        )
        .returning({ id: questions.id });

      if (!deletedQuestion) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Question not found.",
        });
      }

      return {
        message: "Question deleted successfully!",
      };
    }),

  // ----------------------------------------------
  // QUESTIONS - REORDER
  // ----------------------------------------------

  reorderQuestions: protectedProcedure
    .input(
      z.object({
        formId: z.string().uuid(),
        questionIds: z.array(z.string().uuid()).min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
          message: "Form not found.",
        });
      }

      if (new Set(input.questionIds).size !== input.questionIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Duplicate question IDs are not allowed.",
        });
      }

      const existingQuestions = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.formId, input.formId));

      const existingIds = new Set(
        existingQuestions.map((question) => question.id)
      );

      if (
        existingIds.size !== input.questionIds.length ||
        input.questionIds.some((id) => !existingIds.has(id))
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid question list.",
        });
      }

      await db.transaction(async (tx) => {
        for (const [index, questionId] of input.questionIds.entries()) {
          await tx
            .update(questions)
            .set({ position: index + 1 })
            .where(
              and(
                eq(questions.id, questionId),
                eq(questions.formId, input.formId)
              )
            );
        }
      });

      return {
        message: "Questions reordered successfully!",
      };
    }),
});

export type AppRouter = typeof appRouter;
