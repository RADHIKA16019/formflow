
import { sql } from "drizzle-orm";

import { db } from "../db/index.js";
import { publicProcedure, protectedProcedure, t } from "./trpc.js";
import { notificationsRouter } from "./routers/notifications.js";
import { formsRouter } from "./routers/forms.js";
import { questionsRouter } from "./routers/questions.js";
import { pagesRouter } from "./routers/pages.js";
import { responsesRouter } from "./routers/responses.js";
import { analyticsRouter } from "./routers/analytics.js";
import { publicFormsRouter } from "./routers/public-forms.js";

// General application procedures
const generalRouter = t.router({
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
});


export const appRouter = t.mergeRouters(
  generalRouter,
  formsRouter,
  questionsRouter,
  pagesRouter,
  responsesRouter,
  analyticsRouter,
  publicFormsRouter,
  notificationsRouter
);

export type AppRouter = typeof appRouter;


