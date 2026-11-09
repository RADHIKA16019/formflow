
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { db } from "../../db/index.js";
import { forms, responses } from "../../db/schema.js";
import { protectedProcedure, t } from "../trpc.js";

const analyticsDaysSchema = z.enum(["7", "30", "90"]).default("30");

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
});
