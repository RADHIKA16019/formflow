
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { toNodeHandler } from "better-auth/node";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

import { auth } from "./auth.js";
import { appRouter } from "./trpc/router.js";
import { createContext } from "./trpc/context.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

// Better Auth routes — must come before express.json()
app.all("/api/auth/{*any}", toNodeHandler(auth));

// JSON middleware for other API routes
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Welcome to FormFlow API!",
  });
});

// tRPC routes
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

app.listen(PORT, () => {
  console.log(`FormFlow API running on port ${PORT}`);
});
