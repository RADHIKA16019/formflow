
import { count, eq, sql } from "drizzle-orm";

import { db } from "../../db/index.js";
import { forms, responses } from "../../db/schema.js";
import { protectedProcedure, t } from "../trpc.js";

export const analyticsRouter = t.router({
  getResponseAnalytics: protectedProcedure.query(async ({ ctx }) => {
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
      .where(eq(forms.ownerId, ctx.session.user.id))
      .groupBy(
        sql`DATE(${responses.submittedAt} + INTERVAL '5 hours 30 minutes')`
      )
      .orderBy(
        sql`DATE(${responses.submittedAt} + INTERVAL '5 hours 30 minutes')`
      );
  }),
});
