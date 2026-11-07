
import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  integer,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";

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

// Users table
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Forms table
export const forms = pgTable("forms", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  slug: text("slug").unique(),
  status: formStatusEnum("status").default("draft").notNull(),
  visibility: formVisibilityEnum("visibility").default("unlisted").notNull(),
  publishedAt: timestamp("published_at"),
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
  config: jsonb("config").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
