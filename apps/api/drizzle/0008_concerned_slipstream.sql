CREATE TYPE "public"."subscription_plan" AS ENUM('free', 'pro', 'business');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "subscription_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"forms_created" integer DEFAULT 0 NOT NULL,
	"responses_received" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"plan" "subscription_plan" DEFAULT 'free' NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp with time zone DEFAULT now() NOT NULL,
	"current_period_end" timestamp with time zone,
	"payment_provider" varchar(50),
	"payment_reference" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "subscription_usage" ADD CONSTRAINT "subscription_usage_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_usage_period_unique" ON "subscription_usage" USING btree ("subscription_id","period_start");
--> statement-breakpoint
INSERT INTO "subscriptions" ("user_id")
SELECT "id" FROM "user"
ON CONFLICT ("user_id") DO NOTHING;

--> statement-breakpoint
INSERT INTO "subscription_usage" (
  "subscription_id",
  "period_start",
  "forms_created",
  "responses_received"
)
SELECT
  s."id",
  date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',
  (
    SELECT count(*)::integer
    FROM "forms" f
    WHERE f."owner_id" = s."user_id"
      AND f."created_at" >= date_trunc('month', now() AT TIME ZONE 'UTC')
  ),
  (
    SELECT count(*)::integer
    FROM "responses" r
    INNER JOIN "forms" f ON f."id" = r."form_id"
    WHERE f."owner_id" = s."user_id"
      AND r."submitted_at" >= date_trunc('month', now() AT TIME ZONE 'UTC')
  )
FROM "subscriptions" s
ON CONFLICT ("subscription_id", "period_start") DO NOTHING;
