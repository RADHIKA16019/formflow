
import { and, asc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { db } from "../../db/index.js";
import { forms, formPages, questions } from "../../db/schema.js";
import { protectedProcedure, t } from "../trpc.js";

export const pagesRouter = t.router({
  getPages: protectedProcedure
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
          message: "Form not found",
        });
      }

      let pages = await db
        .select()
        .from(formPages)
        .where(eq(formPages.formId, input.formId))
        .orderBy(asc(formPages.pageNumber));

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
    .input(z.object({ pageId: z.string().uuid() }))
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
});
