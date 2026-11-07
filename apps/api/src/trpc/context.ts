import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { auth } from "../auth.js";

export async function createContext({
  req,
}: CreateExpressContextOptions) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      headers.set(
        key,
        Array.isArray(value) ? value.join(", ") : value
      );
    }
  }

  const session = await auth.api.getSession({
    headers,
  });

  return {
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
