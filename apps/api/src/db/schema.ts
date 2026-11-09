
import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  integer,
  uuid,
  varchar,
  jsonb,
} from "drizzle-orm/pg-core";

import { uniqueIndex } from "drizzle-orm/pg-core";

import {
  user,
  session,
  account,
  verification,
} from "./auth-schema.js";

export { user, session, account, verification };

// Form status
export const formStatusEnum = pgEnum("form_status", [
  "draft",
  "published",
  "archived",
]);

// Form visibility
export const formVisibilityEnum = pgEnum("form_visibility", [
  "public",
  "unlisted",
]);

// Question types
export const questionTypeEnum = pgEnum("question_type", [
  "text",
  "email",
  "number",
  "select",
  "checkbox",
  "rating",
  "date",
]);

export type FormTheme = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  buttonStyle: "rounded" | "pill" | "square";
  borderRadius: "small" | "medium" | "large";
  backgroundStyle: "solid" | "gradient";
  backgroundImage?: string;
  backgroundImageName?: string;
};

// Forms table

export const forms = pgTable("forms", {
  id: uuid("id").defaultRandom().primaryKey(),

  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  description: text("description"),
  slug: text("slug").unique(),

  status: formStatusEnum("status").default("draft").notNull(),
  visibility: formVisibilityEnum("visibility").default("unlisted").notNull(),

  publishedAt: timestamp("published_at"),

  expiresAt: timestamp("expires_at", {
    withTimezone: true,
  }),

  responseLimit: integer("response_limit"),

  // Archive support
  archivedAt: timestamp("archived_at", {
    withTimezone: true,
  }),
  theme: jsonb("theme")
  .$type<FormTheme>()
  .notNull()
  .default({
    primaryColor: "#B7B09E",
    secondaryColor: "#CFC6B1",
    backgroundColor: "#EBE2CC",
    fontFamily: "Inter",
    buttonStyle: "rounded",
    borderRadius: "medium",
    backgroundStyle: "solid",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});


// Questions table
export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),

  formId: uuid("form_id")
    .notNull()
    .references(() => forms.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  description: text("description"),

  type: questionTypeEnum("type").notNull(),

  required: boolean("required").default(false).notNull(),

  position: integer("position").notNull(),

  // Multi-page form support
  pageNumber: integer("page_number").default(1).notNull(),

  config: jsonb("config").default({}).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const formPages = pgTable(
  "form_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),

    pageNumber: integer("page_number").notNull(),

    title: varchar("title", { length: 200 })
      .notNull()
      .default("Untitled Page"),

    description: varchar("description", { length: 500 }),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("form_pages_form_page_unique").on(
      table.formId,
      table.pageNumber
    ),
  ]
);

// Responses table
export const responses = pgTable("responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  formId: uuid("form_id")
    .notNull()
    .references(() => forms.id, { onDelete: "cascade" }),
  respondentEmail: text("respondent_email"),
  answers: jsonb("answers").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

// Notifications table
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),

    responseId: uuid("response_id")
      .notNull()
      .references(() => responses.id, { onDelete: "cascade" }),

    title: text("title").notNull(),

    message: text("message").notNull(),

    readAt: timestamp("read_at"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("notifications_response_unique").on(
      table.responseId
    ),
  ]
);
