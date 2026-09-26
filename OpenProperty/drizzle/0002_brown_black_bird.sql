CREATE TYPE "public"."lease_signature_status" AS ENUM('draft', 'sent', 'viewed', 'partially_signed', 'completed', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."signature_provider" AS ENUM('firma_dev');--> statement-breakpoint
CREATE TYPE "public"."signature_recipient_role" AS ENUM('owner', 'tenant');--> statement-breakpoint
CREATE TYPE "public"."signature_recipient_status" AS ENUM('pending', 'viewed', 'signed', 'declined');--> statement-breakpoint
CREATE TABLE "firma_webhook_deliveries" (
	"delivery_id" text PRIMARY KEY NOT NULL,
	"event_id" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lease_signature_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"signature_id" uuid NOT NULL,
	"provider_recipient_id" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "signature_recipient_role" NOT NULL,
	"sort_order" integer DEFAULT 1 NOT NULL,
	"status" "signature_recipient_status" DEFAULT 'pending' NOT NULL,
	"signed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lease_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"provider" "signature_provider" DEFAULT 'firma_dev' NOT NULL,
	"provider_request_id" text,
	"status" "lease_signature_status" DEFAULT 'draft' NOT NULL,
	"document_id" uuid,
	"source_document_id" uuid,
	"created_by" uuid,
	"sent_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"audit" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_lease_signatures_id_org" ON "lease_signatures" USING btree ("id","organization_id");--> statement-breakpoint
ALTER TABLE "lease_signature_recipients" ADD CONSTRAINT "lease_signature_recipients_signature_id_organization_id_lease_signatures_id_organization_id_fk" FOREIGN KEY ("signature_id","organization_id") REFERENCES "public"."lease_signatures"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD CONSTRAINT "lease_signatures_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD CONSTRAINT "lease_signatures_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD CONSTRAINT "lease_signatures_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_signatures" ADD CONSTRAINT "lease_signatures_lease_id_organization_id_leases_id_organization_id_fk" FOREIGN KEY ("lease_id","organization_id") REFERENCES "public"."leases"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lease_signature_recipients_org" ON "lease_signature_recipients" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_lease_signature_recipients_signature" ON "lease_signature_recipients" USING btree ("signature_id");--> statement-breakpoint
CREATE INDEX "idx_lease_signatures_org" ON "lease_signatures" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_lease_signatures_lease" ON "lease_signatures" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "idx_lease_signatures_document" ON "lease_signatures" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_lease_signatures_source_document" ON "lease_signatures" USING btree ("source_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_lease_signatures_provider_request" ON "lease_signatures" USING btree ("provider_request_id") WHERE "lease_signatures"."provider_request_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_lease_signatures_open" ON "lease_signatures" USING btree ("organization_id","lease_id") WHERE "lease_signatures"."status" IN ('draft', 'sent', 'viewed', 'partially_signed');