
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
import { forms, questions, responses, formPages } from "../db/schema.js";
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


function remapQuestionConfig(
  config: unknown,
  questionIdMap: Map<string, string>
): unknown {
  if (
    !config ||
    typeof config !== "object" ||
    Array.isArray(config)
  ) {
    return config;
  }

  const copied = { ...(config as Record<string, unknown>) };

  const logic = copied.logic;

  if (
    logic &&
    typeof logic === "object" &&
    !Array.isArray(logic)
  ) {
    const logicConfig = logic as Record<string, unknown>;

    if (typeof logicConfig.questionId === "string") {
      copied.logic = {
        ...logicConfig,
        questionId:
          questionIdMap.get(logicConfig.questionId) ??
          logicConfig.questionId,
      };
    }
  }

  return copied;
}


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


const questionLogicSchema = z.object({
  action: z.enum(["show", "hide"]).default("show"),
  questionId: z.string().uuid(),
  operator: z.enum([
    "equals",
    "notEquals",
    "contains",
  ]),
  value: z.union([
    z.string().max(500),
    z.number().finite(),
  ]),
});

const questionConfigSchema = z.object({
  options: z.array(
    z.string().trim().min(1).max(100)
  ).max(50).optional(),

  min: z.number().finite().optional(),
  max: z.number().finite().optional(),

  logic: questionLogicSchema.optional(),
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
  pageNumber: z.number().int().min(1).optional(),
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

const formThemeSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  fontFamily: z.string().min(1).max(80),
  buttonStyle: z.enum(["rounded", "pill", "square"]),
  borderRadius: z.enum(["small", "medium", "large"]),
  backgroundStyle: z.enum(["solid", "gradient"]),
});

// --------------------------------------------------
// APP ROUTER
// --------------------------------------------------

export const appRouter = t.router({

  
  // -----------------------------------------
  // CLONE FORM
  // -----------------------------------------

  cloneForm: protectedProcedure
    .input(z.object({ formId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ownerId = ctx.session.user.id;

      return db.transaction(async (tx) => {
        const [original] = await tx
          .select()
          .from(forms)
          .where(
            and(
              eq(forms.id, input.formId),
              eq(forms.ownerId, ownerId)
            )
          )
          .limit(1);

        if (!original) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Form not found.",
          });
        }

        const originalPages = await tx
          .select()
          .from(formPages)
          .where(eq(formPages.formId, original.id))
          .orderBy(asc(formPages.pageNumber));

        const originalQuestions = await tx
          .select()
          .from(questions)
          .where(eq(questions.formId, original.id))
          .orderBy(asc(questions.position));

        const [clonedForm] = await tx
          .insert(forms)
          .values({
            ownerId,
            title: `${original.title} (Copy)`,
            description: original.description,
            slug: null,
            status: "draft",
            visibility: original.visibility,
            publishedAt: null,
            expiresAt: original.expiresAt,
            responseLimit: original.responseLimit,
            archivedAt: null,
            updatedAt: new Date(),
          })
          .returning();

        if (originalPages.length > 0) {
          await tx.insert(formPages).values(
            originalPages.map((page) => ({
              formId: clonedForm.id,
              pageNumber: page.pageNumber,
              title: page.title,
              description: page.description,
            }))
          );
        }

        const questionIdMap = new Map<string, string>();

        originalQuestions.forEach((question) => {
          questionIdMap.set(question.id, randomUUID());
        });

        if (originalQuestions.length > 0) {
          await tx.insert(questions).values(
            originalQuestions.map((question) => ({
              id: questionIdMap.get(question.id)!,
              formId: clonedForm.id,
              title: question.title,
              description: question.description,
              type: question.type,
              required: question.required,
              position: question.position,
              pageNumber: question.pageNumber,
              config: remapQuestionConfig(
                question.config,
                questionIdMap
              ),
            }))
          );
        }

        return clonedForm;
      });
    }),

  // -----------------------------------------
  // ARCHIVE FORM
  // -----------------------------------------

  archiveForm: protectedProcedure
    .input(z.object({ formId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [archived] = await db
        .update(forms)
        .set({
          archivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(forms.id, input.formId),
            eq(forms.ownerId, ctx.session.user.id)
          )
        )
        .returning();

      if (!archived) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found.",
        });
      }

      return {
        success: true,
        form: archived,
      };
    }),

  // -----------------------------------------
  // RESTORE FORM
  // -----------------------------------------

  restoreForm: protectedProcedure
    .input(z.object({ formId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [restored] = await db
        .update(forms)
        .set({
          archivedAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(forms.id, input.formId),
            eq(forms.ownerId, ctx.session.user.id)
          )
        )
        .returning();

      if (!restored) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Form not found.",
        });
      }

      return {
        success: true,
        form: restored,
      };
    }),

  // -----------------------------------------
  // PERMANENTLY DELETE FORM
  // -----------------------------------------

  // deleteForm: protectedProcedure
  //   .input(z.object({ formId: z.string().uuid() }))
  //   .mutation(async ({ ctx, input }) => {
  //     const [deleted] = await db
  //       .delete(forms)
  //       .where(
  //         and(
  //           eq(forms.id, input.formId),
  //           eq(forms.ownerId, ctx.session.user.id)
  //         )
  //       )
  //       .returning({
  //         id: forms.id,
  //       });

  //     if (!deleted) {
  //       throw new TRPCError({
  //         code: "NOT_FOUND",
  //         message: "Form not found.",
  //       });
  //     }

  //     return {
  //       success: true,
  //       id: deleted.id,
  //     };
  //   }),


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
      expiresAt: z.coerce.date().nullable().optional(),
      responseLimit: z.number().int().positive().nullable().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const [newForm] = await db
      .insert(forms)
      .values({
        ownerId: ctx.session.user.id,
        title: input.title,
        description: input.description,
        expiresAt: input.expiresAt ?? null,
        responseLimit: input.responseLimit ?? null,
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

getResponseAnalytics: protectedProcedure.query(async ({ ctx }) => {
  const analytics = await db
    .select({
      date: sql<string>`
        TO_CHAR(
          DATE(${responses.submittedAt} + INTERVAL '5 hours 30 minutes'),
          'YYYY-MM-DD'
        )
      `,
      total: count(responses.id),
    })
    .from(responses)
    .innerJoin(forms, eq(responses.formId, forms.id))
    .where(eq(forms.ownerId, ctx.session.user.id))
    .groupBy(
      sql`DATE(${responses.submittedAt} + INTERVAL '5 hours 30 minutes')`
    )
    .orderBy(
      sql`DATE(${responses.submittedAt} + INTERVAL '5 hours 30 minutes')`
    );

  return analytics;
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

  // ----------------------------------------------
  // RESPONSES - DELETE
  // ----------------------------------------------

  deleteResponse: protectedProcedure
    .input(
      z.object({
        responseId: z.string().uuid(),
      })
    )
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
        .returning({
          id: responses.id,
        });

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
      expiresAt: z.coerce.date().nullable().optional(),
      responseLimit: z.number().int().positive().nullable().optional(),
      theme: formThemeSchema.optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const [updatedForm] = await db
      .update(forms)
      .set({
        title: input.title,
        description: input.description,
        updatedAt: new Date(),

        ...(input.expiresAt !== undefined
          ? { expiresAt: input.expiresAt }
          : {}),

        ...(input.responseLimit !== undefined
          ? { responseLimit: input.responseLimit }
          : {}),

          ...(input.theme !== undefined
  ? { theme: input.theme }
  : {}),
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

  updateFormLimits: protectedProcedure
  .input(
    z.object({
      formId: z.string().uuid(),
      expiresAt: z.coerce.date().nullable(),
      responseLimit: z.number().int().positive().max(1000000).nullable(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    if (input.expiresAt && input.expiresAt <= new Date()) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Expiry date must be in the future.",
      });
    }

    const [updatedForm] = await db
      .update(forms)
      .set({
        expiresAt: input.expiresAt,
        responseLimit: input.responseLimit,
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
      message: "Form limits updated successfully!",
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
        expiresAt: forms.expiresAt,
responseLimit: forms.responseLimit,
theme: forms.theme,
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

    const pages = await db
      .select({
        pageNumber: formPages.pageNumber,
        title: formPages.title,
        description: formPages.description,
      })
      .from(formPages)
      .where(eq(formPages.formId, form.id))
      .orderBy(asc(formPages.pageNumber));

    const formQuestions = await db
      .select({
        id: questions.id,
        title: questions.title,
        description: questions.description,
        type: questions.type,
        required: questions.required,
        position: questions.position,
        pageNumber: questions.pageNumber,
        config: questions.config,
      })
      .from(questions)
      .where(eq(questions.formId, form.id))
      .orderBy(
        asc(questions.pageNumber),
        asc(questions.position)
      );

      const [responseCountResult] = await db
  .select({
    total: count(),
  })
  .from(responses)
  .where(eq(responses.formId, form.id));

let availabilityStatus:
  | "open"
  | "expired"
  | "limit_reached" = "open";

if (
  form.expiresAt &&
  form.expiresAt.getTime() <= Date.now()
) {
  availabilityStatus = "expired";
} else if (
  form.responseLimit !== null &&
  Number(responseCountResult.total) >= form.responseLimit
) {
  availabilityStatus = "limit_reached";
}

    return {
      form,
      availabilityStatus,
      pages:
        pages.length > 0
          ? pages
          : [
              {
                pageNumber: 1,
                title: "Page 1",
                description: null,
              },
            ],
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

    // 6. Atomically check availability and save response.
await db.transaction(async (tx) => {
  // Lock the form row so simultaneous submissions
  // cannot exceed the configured response limit.
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
    .select({
      total: count(),
    })
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

getPages: protectedProcedure
  .input(
    z.object({
      formId: z.string().uuid(),
    })
  )
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
        message: "Form not found",
      });
    }

    let pages = await db
      .select()
      .from(formPages)
      .where(eq(formPages.formId, input.formId))
      .orderBy(asc(formPages.pageNumber));

    // Ensure every existing form has at least Page 1.
    if (pages.length === 0) {
      await db.insert(formPages).values({
        formId: input.formId,
        pageNumber: 1,
        title: "Page 1",
      });

      pages = await db
        .select()
        .from(formPages)
        .where(eq(formPages.formId, input.formId))
        .orderBy(asc(formPages.pageNumber));
    }

    return pages;
  }),

createPage: protectedProcedure
  .input(
    z.object({
      formId: z.string().uuid(),
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().trim().max(500).optional(),
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
        message: "Form not found",
      });
    }

    const [result] = await db
      .select({
        maxPage: sql<number>`COALESCE(MAX(${formPages.pageNumber}), 0)`,
      })
      .from(formPages)
      .where(eq(formPages.formId, input.formId));

    const nextPageNumber = Number(result.maxPage) + 1;

    const [page] = await db
      .insert(formPages)
      .values({
        formId: input.formId,
        pageNumber: nextPageNumber,
        title: input.title ?? `Page ${nextPageNumber}`,
        description: input.description,
      })
      .returning();

    return page;
  }),

updatePage: protectedProcedure
  .input(
    z.object({
      pageId: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().max(500).nullable().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const [page] = await db
      .select()
      .from(formPages)
      .innerJoin(forms, eq(formPages.formId, forms.id))
      .where(
        and(
          eq(formPages.id, input.pageId),
          eq(forms.ownerId, ctx.session.user.id)
        )
      )
      .limit(1);

    if (!page) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Page not found",
      });
    }

    const [updatedPage] = await db
      .update(formPages)
      .set({
        title: input.title,
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
      })
      .where(eq(formPages.id, input.pageId))
      .returning();

    return updatedPage;
  }),

moveQuestionToPage: protectedProcedure
  .input(
    z.object({
      formId: z.string().uuid(),
      questionId: z.string().uuid(),
      pageNumber: z.number().int().min(1),
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
        message: "Form not found",
      });
    }

    const [page] = await db
      .select()
      .from(formPages)
      .where(
        and(
          eq(formPages.formId, input.formId),
          eq(formPages.pageNumber, input.pageNumber)
        )
      )
      .limit(1);

    if (!page) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Target page not found",
      });
    }

    const [question] = await db
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.id, input.questionId),
          eq(questions.formId, input.formId)
        )
      )
      .limit(1);

    if (!question) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Question not found",
      });
    }

    const [positionResult] = await db
      .select({
        maxPosition: sql<number>`COALESCE(MAX(${questions.position}), -1)`,
      })
      .from(questions)
      .where(
        and(
          eq(questions.formId, input.formId),
          eq(questions.pageNumber, input.pageNumber)
        )
      );

    const nextPosition = Number(positionResult.maxPosition) + 1;

    const [updatedQuestion] = await db
      .update(questions)
      .set({
        pageNumber: input.pageNumber,
        position: nextPosition,
      })
      .where(eq(questions.id, input.questionId))
      .returning();

    return updatedQuestion;
  }),

deletePage: protectedProcedure
  .input(
    z.object({
      pageId: z.string().uuid(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const [page] = await db
      .select()
      .from(formPages)
      .innerJoin(forms, eq(formPages.formId, forms.id))
      .where(
        and(
          eq(formPages.id, input.pageId),
          eq(forms.ownerId, ctx.session.user.id)
        )
      )
      .limit(1);

    if (!page) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Page not found",
      });
    }

    const currentPage = page.form_pages;
    const formId = currentPage.formId;

    const allPages = await db
      .select()
      .from(formPages)
      .where(eq(formPages.formId, formId))
      .orderBy(asc(formPages.pageNumber));

    if (allPages.length <= 1) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "A form must have at least one page",
      });
    }

    const targetPage = allPages.find(
      (item) => item.id !== input.pageId
    );

    if (!targetPage) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Target page not found",
      });
    }

    await db.transaction(async (tx) => {
      const [positionResult] = await tx
        .select({
          maxPosition: sql<number>`COALESCE(MAX(${questions.position}), -1)`,
        })
        .from(questions)
        .where(
          and(
            eq(questions.formId, formId),
            eq(questions.pageNumber, targetPage.pageNumber)
          )
        );

      await tx
        .update(questions)
        .set({
          pageNumber: targetPage.pageNumber,
          position: sql`${questions.position} + ${Number(positionResult.maxPosition) + 1}`,
        })
        .where(
          and(
            eq(questions.formId, formId),
            eq(questions.pageNumber, currentPage.pageNumber)
          )
        );

      await tx
        .delete(formPages)
        .where(eq(formPages.id, input.pageId));

      const remainingPages = allPages.filter(
        (item) => item.id !== input.pageId
      );

      for (let index = 0; index < remainingPages.length; index++) {
        const oldPage = remainingPages[index];
        const newPageNumber = index + 1;

        if (oldPage.pageNumber !== newPageNumber) {
          await tx
            .update(formPages)
            .set({ pageNumber: newPageNumber })
            .where(eq(formPages.id, oldPage.id));

          await tx
            .update(questions)
            .set({ pageNumber: newPageNumber })
            .where(
              and(
                eq(questions.formId, formId),
                eq(questions.pageNumber, oldPage.pageNumber)
              )
            );
        }
      }
    });

    return { success: true };
  }),

reorderPages: protectedProcedure
  .input(
    z.object({
      formId: z.string().uuid(),
      pageIds: z.array(z.string().uuid()).min(1),
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
        message: "Form not found",
      });
    }

    const existingPages = await db
      .select()
      .from(formPages)
      .where(eq(formPages.formId, input.formId))
      .orderBy(asc(formPages.pageNumber));

    const existingIds = existingPages.map((page) => page.id);

    if (
      input.pageIds.length !== existingIds.length ||
      new Set(input.pageIds).size !== existingIds.length ||
      !input.pageIds.every((id) => existingIds.includes(id))
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid page order",
      });
    }

    await db.transaction(async (tx) => {
      const maxPageNumber = Math.max(
        ...existingPages.map((page) => page.pageNumber)
      );

      const offset = maxPageNumber + existingPages.length + 1;

      // Move all pages and their questions to temporary page numbers.
      for (let index = 0; index < existingPages.length; index++) {
        const page = existingPages[index];
        const temporaryNumber = offset + index;

        await tx
          .update(formPages)
          .set({ pageNumber: temporaryNumber })
          .where(eq(formPages.id, page.id));

        await tx
          .update(questions)
          .set({ pageNumber: temporaryNumber })
          .where(
            and(
              eq(questions.formId, input.formId),
              eq(questions.pageNumber, page.pageNumber)
            )
          );
      }

      // Assign the final page numbers in the requested order.
      for (let index = 0; index < input.pageIds.length; index++) {
        const pageId = input.pageIds[index];
        const originalIndex = existingPages.findIndex(
          (page) => page.id === pageId
        );

        const temporaryNumber = offset + originalIndex;
        const newPageNumber = index + 1;

        await tx
          .update(formPages)
          .set({ pageNumber: newPageNumber })
          .where(eq(formPages.id, pageId));

        await tx
          .update(questions)
          .set({ pageNumber: newPageNumber })
          .where(
            and(
              eq(questions.formId, input.formId),
              eq(questions.pageNumber, temporaryNumber)
            )
          );
      }
    });

    return { success: true };
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
        pageNumber: input.pageNumber ?? 1,
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
      pageNumber: z.number().int().min(1).optional(),
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

        ...(input.pageNumber !== undefined
          ? { pageNumber: input.pageNumber }
          : {}),
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
