CREATE TABLE "attendance_erasure" (
	"email_hash" text PRIMARY KEY NOT NULL,
	"erased_at" timestamp with time zone DEFAULT now() NOT NULL
);
