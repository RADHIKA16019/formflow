
import { initTRPC, TRPCError } from "@trpc/server";
import {
  and,
  eq,
  desc,
  asc,
  sql,
  count,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { db } from "../db/index.js";
import { forms, questions, responses } from "../db/schema.js";
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

const visibilitySchema = z.enum(["public", "unlisted"]);

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
      message:
        "Minimum and maximum are only supported for number and rating questions.",
    });
  }
}

// --------------------------------------------------
// SLUG GENERATION
// --------------------------------------------------

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function generateUniqueSlug(title: string) {
  const baseSlug = slugify(title) || "form";

  // Random suffix makes collisions extremely unlikely.
  const slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;

  const [existingForm] = await db
    .select({ id: forms.id })
    .from(forms)
    .where(eq(forms.slug, slug))
    .limit(1);

  if (existingForm) {
    return generateUniqueSlug(title);
  }

  return slug;
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
  // FORMS - CREATE
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

  // ----------------------------------------------
  // FORMS - READ
  // ----------------------------------------------

  getMyForms: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(forms)
      .where(eq(forms.ownerId, ctx.session.user.id))
      .orderBy(desc(forms.createdAt));
  }),

  getTotalResponses: protectedProcedure
  .query(async ({ ctx }) => {
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
  .input(
    z.object({
      formId: z.string().uuid(),
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
        message: "Form not found or you don't have access to it.",
      });
    }

    // Fetch responses
    const formResponses = await db
      .select({
        id: responses.id,
        respondentEmail: responses.respondentEmail,
        answers: responses.answers,
        submittedAt: responses.submittedAt,
      })
      .from(responses)
      .where(eq(responses.formId, input.formId))
      .orderBy(desc(responses.submittedAt));

    return formResponses;
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

  // ----------------------------------------------
  // FORMS - UPDATE
  // ----------------------------------------------

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

  // ----------------------------------------------
  // FORMS - DELETE
  // ----------------------------------------------

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
  // PUBLISHING - PUBLISH FORM
  // ----------------------------------------------

  publishForm: protectedProcedure
    .input(
      z.object({
        formId: z.string().uuid(),
        visibility: visibilitySchema.default("unlisted"),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      const existingQuestions = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.formId, input.formId));

      if (existingQuestions.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Add at least one question before publishing your form.",
        });
      }

      const slug = form.slug ?? await generateUniqueSlug(form.title);

      const [publishedForm] = await db
        .update(forms)
        .set({
          slug,
          status: "published",
          visibility: input.visibility,
          publishedAt: form.publishedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(forms.id, input.formId),
            eq(forms.ownerId, ctx.session.user.id)
          )
        )
        .returning();

      return {
        message: "Form published successfully!",
        form: publishedForm,
        shareUrl: `/forms/${publishedForm.slug}`,
      };
    }),

  // ----------------------------------------------
  // PUBLISHING - UNPUBLISH FORM
  // ----------------------------------------------

  unpublishForm: protectedProcedure
    .input(formIdSchema)
    .mutation(async ({ ctx, input }) => {
      const [unpublishedForm] = await db
        .update(forms)
        .set({
          status: "draft",
          publishedAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(forms.id, input.formId),
            eq(forms.ownerId, ctx.session.user.id)
          )
        )
        .returning();

      if (!unpublishedForm) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found.",
        });
      }

      return {
        message: "Form unpublished successfully!",
        form: unpublishedForm,
      };
    }),

  // ----------------------------------------------
  // PUBLISHING - UPDATE VISIBILITY
  // ----------------------------------------------

  updateFormVisibility: protectedProcedure
    .input(
      z.object({
        formId: z.string().uuid(),
        visibility: visibilitySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updatedForm] = await db
        .update(forms)
        .set({
          visibility: input.visibility,
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
        message: "Form visibility updated successfully!",
        form: updatedForm,
      };
    }),

  // ----------------------------------------------
  // PUBLIC FORMS - DISCOVERY
  // ----------------------------------------------

  getPublicForms: publicProcedure.query(async () => {
    return db
      .select({
        id: forms.id,
        title: forms.title,
        description: forms.description,
        slug: forms.slug,
        publishedAt: forms.publishedAt,
      })
      .from(forms)
      .where(
        and(
          eq(forms.status, "published"),
          eq(forms.visibility, "public")
        )
      )
      .orderBy(desc(forms.publishedAt))
      .limit(50);
  }),

  // ----------------------------------------------
  // PUBLIC FORMS - ACCESS BY SLUG
  // ----------------------------------------------

  getPublicFormBySlug: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(100),
      })
    )
    .query(async ({ input }) => {
      const [form] = await db
        .select({
          id: forms.id,
          title: forms.title,
          description: forms.description,
          slug: forms.slug,
          status: forms.status,
          visibility: forms.visibility,
          publishedAt: forms.publishedAt,
        })
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
        .select({
          id: questions.id,
          title: questions.title,
          description: questions.description,
          type: questions.type,
          required: questions.required,
          position: questions.position,
          config: questions.config,
        })
        .from(questions)
        .where(eq(questions.formId, form.id))
        .orderBy(asc(questions.position));

      return {
        form,
        questions: formQuestions,
      };
    }),

  // ----------------------------------------------
  // QUESTIONS - READ
  // ----------------------------------------------

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
    // 1. Find published form
    const [form] = await db
      .select({
        id: forms.id,
      })
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

    // 2. Fetch form questions
    const formQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.formId, form.id));

    const questionIds = new Set(
      formQuestions.map((question) => question.id)
    );

    // 3. Reject unknown question IDs
    for (const questionId of Object.keys(input.answers)) {
      if (!questionIds.has(questionId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid question found in submitted answers.",
        });
      }
    }

    // 4. Validate answers
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
        (typeof answer !== "string" && typeof answer !== "number")
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

    // 5. Extract respondent email, if provided
    const emailQuestion = formQuestions.find(
      (question) => question.type === "email"
    );

    const respondentEmail = emailQuestion
      ? input.answers[emailQuestion.id]
      : null;

    // 6. Save response in database
    await db.insert(responses).values({
      formId: form.id,
      respondentEmail:
        typeof respondentEmail === "string" ? respondentEmail : null,
      answers: input.answers,
    });

    return {
      success: true,
      message: "Your response has been submitted successfully.",
    };
  }),


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
        .innerJoin(
          forms,
          eq(questions.formId, forms.id)
        )
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

      if (
        new Set(input.questionIds).size !== input.questionIds.length
      ) {
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
