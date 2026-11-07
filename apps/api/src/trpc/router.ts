import { initTRPC, TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create();

// Public procedure: anyone can access
const publicProcedure = t.procedure;

// Protected procedure: login required
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource.",
    });
  }

  return next({
    ctx: {
      session: ctx.session,
    },
  });
});

export const appRouter = t.router({
  hello: publicProcedure.query(() => {
    return {
      message: "Hello from FormFlow tRPC!",
    };
  }),

  dbHealth: publicProcedure.query(async () => {
    await db.execute(sql`SELECT 1`);

    return {
      message: "FormFlow database connected successfully!",
    };
  }),

  getProfile: protectedProcedure.query(({ ctx }) => {
    return {
      message: "Authenticated successfully!",
      user: ctx.session.user,
    };
  }),
});

export type AppRouter = typeof appRouter;