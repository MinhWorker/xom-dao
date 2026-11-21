CREATE TABLE "disabled_games" (
	"game_id" text PRIMARY KEY NOT NULL,
	"disabled_at" timestamp with time zone DEFAULT now() NOT NULL
);
