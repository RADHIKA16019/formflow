
import { TRPCError } from "@trpc/server";
import { and, eq, desc, asc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { db } from "../../db/index.js";
import { forms, questions, formPages } from "../../db/schema.js";
import { t, protectedProcedure } from "../trpc.js";

// -----------------------------------------
// VALIDATION SCHEMAS
// -----------------------------------------

const formIdSchema = z.object({
  formId: z.string().uuid(),
});

const visibilitySchema = z.enum(["public", "unlisted"]);

const formThemeSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  fontFamily: z.string().min(1).max(80),
  buttonStyle: z.enum(["rounded", "pill", "square"]),
  borderRadius: z.enum(["small", "medium", "large"]),
  backgroundStyle: z.enum(["solid", "gradient"]),
  backgroundImage: z.string().max(1500000).optional(),
  backgroundImageName: z.string().max(255).optional(),
});

// -----------------------------------------
// HELPERS
// -----------------------------------------

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

// -----------------------------------------
// FORMS ROUTER
// -----------------------------------------

export const formsRouter = t.router({

  // CLONE FORM

  cloneForm: protectedProcedure
    .input(formIdSchema)
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

  // ARCHIVE FORM

  archiveForm: protectedProcedure
    .input(formIdSchema)
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

      return { success: true, form: archived };
    }),

  // RESTORE FORM

  restoreForm: protectedProcedure
    .input(formIdSchema)
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

      return { success: true, form: restored };
    }),

  // CREATE FORM

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

  // GET MY FORMS

  getMyForms: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(forms)
      .where(eq(forms.ownerId, ctx.session.user.id))
      .orderBy(desc(forms.createdAt));
  }),

  // GET FORM BY ID

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

  // UPDATE FORM

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

  // UPDATE FORM LIMITS

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

  // DELETE FORM

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

  // PUBLISH FORM

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

  // UNPUBLISH FORM

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

  // UPDATE FORM VISIBILITY

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

});
