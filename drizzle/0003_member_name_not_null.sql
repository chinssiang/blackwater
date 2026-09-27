-- Backfilled by hand before SET NOT NULL: 0002 added the columns nullable, and
-- any row written since holds NULL where the schema now wants ''.
UPDATE "member" SET "first_name" = '' WHERE "first_name" IS NULL;--> statement-breakpoint
UPDATE "member" SET "last_name" = '' WHERE "last_name" IS NULL;--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "first_name" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "first_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "last_name" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "last_name" SET NOT NULL;
