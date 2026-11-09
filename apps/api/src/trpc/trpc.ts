import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context.js";

// Initialize tRPC
export const t = initTRPC.context<Context>().create();

// Public procedures
export const publicProcedure = t.procedure;

// Protected procedures
export const protectedProcedure = t.procedure.use(
  ({ ctx, next }) => {
    if (!ctx.session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in.",
      });
    }

    return next({
      ctx: {
        session: ctx.session,
      },
    });
  }
);