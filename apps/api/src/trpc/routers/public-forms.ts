
import { and, asc, count, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { db } from "../../db/index.js";
import { forms, formPages, questions, responses } from "../../db/schema.js";
import { publicProcedure, t } from "../trpc.js";

export const publicFormsRouter = t.router({
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

  getPublicFormBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
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
        .select({ total: count() })
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
});
