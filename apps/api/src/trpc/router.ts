import { initTRPC } from "@trpc/server";

const t = initTRPC.create();

export const appRouter = t.router({
  hello: t.procedure.query(() => {
    return {
      message: "Hello from FormFlow tRPC!",
    };
  }),
});

export type AppRouter = typeof appRouter;