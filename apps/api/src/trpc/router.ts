
import { initTRPC } from "@trpc/server";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";

const t = initTRPC.create();

export const appRouter = t.router({
  hello: t.procedure.query(() => {
    return {
      message: "Hello from FormFlow tRPC!",
    };
  }),

  dbHealth: t.procedure.query(async () => {
    await db.execute(sql`SELECT 1`);

    return {
      message: "FormFlow database connected successfully!",
    };
  }),
});

export type AppRouter = typeof appRouter;
