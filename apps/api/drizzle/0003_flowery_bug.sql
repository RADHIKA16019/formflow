CREATE TABLE "form_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"title" varchar(200) DEFAULT 'Untitled Page' NOT NULL,
	"description" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form_pages" ADD CONSTRAINT "form_pages_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "form_pages_form_page_unique" ON "form_pages" USING btree ("form_id","page_number");