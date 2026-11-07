
import { initTRPC, TRPCError } from "@trpc/server";
import { eq, desc, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db/index.js";
import { forms } from "../db/schema.js";
import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create();

// Public procedure: Anyone can access
const publicProcedure = t.procedure;

// Protected procedure: Login required
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
  // Test API
  hello: publicProcedure.query(() => {
    return {
      message: "Hello from FormFlow tRPC!",
    };
  }),

  // Check database connection
  dbHealth: publicProcedure.query(async () => {
    await db.execute(sql`SELECT 1`);

    return {
      message: "FormFlow database connected successfully!",
    };
  }),

  // Get logged-in user's profile
  getProfile: protectedProcedure.query(({ ctx }) => {
    return {
      message: "Authenticated successfully!",
      user: ctx.session.user,
    };
  }),

  // Create a new form
  createForm: protectedProcedure
    .input(
      z.object({
        title: z
          .string()
          .trim()
          .min(1, "Form title is required")
          .max(100),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [newForm] = await db
        .insert(forms)
        .values({
          ownerId: ctx.session.user.id,
          title: input.title,
          description: input.description,
        })
        .returning();

      return {
        message: "Form created successfully!",
        form: newForm,
      };
    }),

  // Get all forms created by the logged-in user
  getMyForms: protectedProcedure.query(async ({ ctx }) => {
    const userForms = await db
      .select()
      .from(forms)
      .where(eq(forms.ownerId, ctx.session.user.id))
      .orderBy(desc(forms.createdAt));

    return userForms;
  }),
});

export type AppRouter = typeof appRouter;
