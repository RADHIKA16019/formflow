
import { and, count, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db/index.js";
import { forms, responses } from "../../db/schema.js";
import { protectedProcedure, t } from "../trpc.js";

export const analyticsRouter = t.router({
  getResponseAnalytics: protectedProcedure
    .input(
      z
        .object({
          days: z.enum(["7", "30", "90"]).default("30"),
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
});
