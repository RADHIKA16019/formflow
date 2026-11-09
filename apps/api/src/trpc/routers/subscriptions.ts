
import { and, count, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { db } from "../../db/index.js";
import {
  forms,
  responses,
  subscriptions,
  subscriptionUsage,
} from "../../db/schema.js";
import { protectedProcedure, t } from "../trpc.js";

const PLAN_LIMITS = {
  free: {
    forms: 3,
    responses: 100,
  },
  pro: {
    forms: 20,
    responses: 2000,
  },
  business: {
    forms: null,
    responses: 10000,
  },
} as const;

export const subscriptionsRouter = t.router({
  getMySubscription: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    await db
      .insert(subscriptions)
      .values({ userId })
      .onConflictDoNothing();

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (!subscription) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to load your subscription.",
      });
    }

    const plan =
      subscription.status === "active" ? subscription.plan : "free";

    const now = new Date();
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );

    await db
      .insert(subscriptionUsage)
      .values({
        subscriptionId: subscription.id,
        periodStart,
        formsCreated: 0,
        responsesReceived: 0,
      })
      .onConflictDoNothing();

    const [usage] = await db
      .select()
      .from(subscriptionUsage)
      .where(
        and(
          eq(subscriptionUsage.subscriptionId, subscription.id),
          eq(subscriptionUsage.periodStart, periodStart)
        )
      )
      .limit(1);

    if (!usage) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to load your monthly usage.",
      });
    }

    const [totalForms] = await db
      .select({ total: count() })
      .from(forms)
      .where(eq(forms.ownerId, userId));

    const [totalResponses] = await db
      .select({ total: count() })
      .from(responses)
      .innerJoin(forms, eq(responses.formId, forms.id))
      .where(eq(forms.ownerId, userId));

    const limits = PLAN_LIMITS[plan];

    return {
      plan,
      status: subscription.status,
      currentPeriodStart: periodStart,
      totalForms: Number(totalForms.total),
      totalResponses: Number(totalResponses.total),
      monthlyResponsesUsed: usage.responsesReceived,
      limits,
    };
  }),
});
