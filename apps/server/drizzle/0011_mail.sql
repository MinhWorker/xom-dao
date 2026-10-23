CREATE TABLE "letter_receipts" (
	"letter_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone,
	"claimed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "letter_receipts_letter_id_user_id_pk" PRIMARY KEY("letter_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "letters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "letter_receipts" ADD CONSTRAINT "letter_receipts_letter_id_letters_id_fk" FOREIGN KEY ("letter_id") REFERENCES "public"."letters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_receipts" ADD CONSTRAINT "letter_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letters" ADD CONSTRAINT "letters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "letters_user_idx" ON "letters" USING btree ("user_id","sent_at");