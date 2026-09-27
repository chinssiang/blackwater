CREATE TABLE "event_attendance" (
	"email" text NOT NULL,
	"luma_event_url" text NOT NULL,
	"event_name" text DEFAULT '' NOT NULL,
	"event_starts_at" timestamp with time zone,
	"registered_at" timestamp with time zone,
	"checked_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_attendance_email_luma_event_url_pk" PRIMARY KEY("email","luma_event_url")
);
--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "phone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "country" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "birthday" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "emergency_contact_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "emergency_contact_phone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "preferred_locale" text DEFAULT '' NOT NULL;