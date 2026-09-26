CREATE TYPE "public"."notification_entity_type" AS ENUM('rent_charge', 'lease', 'work_order', 'lease_signature');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('rent_due', 'rent_overdue', 'lease_expiring', 'work_order', 'signature', 'system');--> statement-breakpoint
CREATE TYPE "public"."notification_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"severity" "notification_severity" NOT NULL,
	"entity_type" "notification_entity_type",
	"entity_id" uuid,
	"period" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_notifications_dedupe" UNIQUE NULLS NOT DISTINCT("organization_id","kind","entity_id","period"),
	CONSTRAINT "notifications_title_len" CHECK (char_length("notifications"."title") BETWEEN 1 AND 160),
	CONSTRAINT "notifications_body_len" CHECK (char_length("notifications"."body") BETWEEN 1 AND 2000),
	CONSTRAINT "notifications_period_len" CHECK (char_length("notifications"."period") BETWEEN 1 AND 80),
	CONSTRAINT "notifications_entity_pair" CHECK ((
        ("notifications"."entity_type" IS NULL AND "notifications"."entity_id" IS NULL)
        OR ("notifications"."entity_type" IS NOT NULL AND "notifications"."entity_id" IS NOT NULL)
      ))
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notifications_org_created" ON "notifications" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_org_kind" ON "notifications" USING btree ("organization_id","kind");--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_unread" ON "notifications" USING btree ("organization_id") WHERE "notifications"."read_at" IS NULL;