CREATE TABLE "quest_progress" (
	"user_id" uuid NOT NULL,
	"day" text NOT NULL,
	"quest_id" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "quest_progress_user_id_day_quest_id_pk" PRIMARY KEY("user_id","day","quest_id")
);
--> statement-breakpoint
ALTER TABLE "quest_progress" ADD CONSTRAINT "quest_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;