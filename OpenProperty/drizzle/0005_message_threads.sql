CREATE TYPE "public"."message_participant_kind" AS ENUM('membership', 'tenant');--> statement-breakpoint
CREATE TYPE "public"."message_participant_role" AS ENUM('from', 'to', 'cc');--> statement-breakpoint
CREATE TYPE "public"."message_thread_entity_type" AS ENUM('property', 'lease', 'tenant', 'work_order');--> statement-breakpoint
ALTER TYPE "public"."document_entity_type" ADD VALUE 'message';--> statement-breakpoint
CREATE TABLE "message_reads" (
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_reads_message_id_user_id_pk" PRIMARY KEY("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "message_thread_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"participant_kind" "message_participant_kind" NOT NULL,
	"user_id" uuid,
	"tenant_id" uuid,
	"email" text NOT NULL,
	"role" "message_participant_role" NOT NULL,
	CONSTRAINT "message_participants_email_len" CHECK (char_length("message_thread_participants"."email") BETWEEN 3 AND 320),
	CONSTRAINT "message_participants_kind" CHECK ((
        ("message_thread_participants"."participant_kind" = 'membership' AND "message_thread_participants"."user_id" IS NOT NULL AND "message_thread_participants"."tenant_id" IS NULL)
        OR ("message_thread_participants"."participant_kind" = 'tenant' AND "message_thread_participants"."tenant_id" IS NOT NULL AND "message_thread_participants"."user_id" IS NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "message_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"entity_type" "message_thread_entity_type",
	"entity_id" uuid,
	"property_id" uuid,
	"lease_id" uuid,
	"tenant_id" uuid,
	"work_order_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_threads_subject_len" CHECK (char_length("message_threads"."subject") BETWEEN 1 AND 200),
	CONSTRAINT "message_threads_entity_pair" CHECK ((
        ("message_threads"."entity_type" IS NULL AND "message_threads"."entity_id" IS NULL AND "message_threads"."property_id" IS NULL AND "message_threads"."lease_id" IS NULL AND "message_threads"."tenant_id" IS NULL AND "message_threads"."work_order_id" IS NULL)
        OR ("message_threads"."entity_type" = 'property' AND "message_threads"."property_id" = "message_threads"."entity_id" AND "message_threads"."lease_id" IS NULL AND "message_threads"."tenant_id" IS NULL AND "message_threads"."work_order_id" IS NULL)
        OR ("message_threads"."entity_type" = 'lease' AND "message_threads"."lease_id" = "message_threads"."entity_id" AND "message_threads"."property_id" IS NULL AND "message_threads"."tenant_id" IS NULL AND "message_threads"."work_order_id" IS NULL)
        OR ("message_threads"."entity_type" = 'tenant' AND "message_threads"."tenant_id" = "message_threads"."entity_id" AND "message_threads"."property_id" IS NULL AND "message_threads"."lease_id" IS NULL AND "message_threads"."work_order_id" IS NULL)
        OR ("message_threads"."entity_type" = 'work_order' AND "message_threads"."work_order_id" = "message_threads"."entity_id" AND "message_threads"."property_id" IS NULL AND "message_threads"."lease_id" IS NULL AND "message_threads"."tenant_id" IS NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_body_len" CHECK (char_length("messages"."body") BETWEEN 1 AND 10000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_message_threads_id_org" ON "message_threads" USING btree ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_messages_id_org" ON "messages" USING btree ("id","organization_id");--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_entity_target";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "message_id" uuid;--> statement-breakpoint
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_message_id_organization_id_messages_id_organization_id_fk" FOREIGN KEY ("message_id","organization_id") REFERENCES "public"."messages"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_thread_participants" ADD CONSTRAINT "message_thread_participants_thread_id_organization_id_message_threads_id_organization_id_fk" FOREIGN KEY ("thread_id","organization_id") REFERENCES "public"."message_threads"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_thread_participants" ADD CONSTRAINT "message_thread_participants_tenant_id_organization_id_tenants_id_organization_id_fk" FOREIGN KEY ("tenant_id","organization_id") REFERENCES "public"."tenants"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_property_id_organization_id_properties_id_organization_id_fk" FOREIGN KEY ("property_id","organization_id") REFERENCES "public"."properties"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_lease_id_organization_id_leases_id_organization_id_fk" FOREIGN KEY ("lease_id","organization_id") REFERENCES "public"."leases"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_tenant_id_organization_id_tenants_id_organization_id_fk" FOREIGN KEY ("tenant_id","organization_id") REFERENCES "public"."tenants"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_work_order_id_organization_id_work_orders_id_organization_id_fk" FOREIGN KEY ("work_order_id","organization_id") REFERENCES "public"."work_orders"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_organization_id_message_threads_id_organization_id_fk" FOREIGN KEY ("thread_id","organization_id") REFERENCES "public"."message_threads"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_message_reads_user" ON "message_reads" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_message_participants_thread" ON "message_thread_participants" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "idx_message_participants_user" ON "message_thread_participants" USING btree ("organization_id","user_id") WHERE "message_thread_participants"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_message_participants_tenant" ON "message_thread_participants" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_message_participants_user" ON "message_thread_participants" USING btree ("thread_id","user_id") WHERE "message_thread_participants"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_message_participants_tenant" ON "message_thread_participants" USING btree ("thread_id","tenant_id") WHERE "message_thread_participants"."tenant_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_message_threads_org_recent" ON "message_threads" USING btree ("organization_id","last_message_at");--> statement-breakpoint
CREATE INDEX "idx_message_threads_property" ON "message_threads" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "idx_message_threads_lease" ON "message_threads" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "idx_message_threads_tenant" ON "message_threads" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_message_threads_work_order" ON "message_threads" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "idx_messages_thread_created" ON "messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_sender" ON "messages" USING btree ("organization_id","sender_user_id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_message_id_organization_id_messages_id_organization_id_fk" FOREIGN KEY ("message_id","organization_id") REFERENCES "public"."messages"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_documents_message_id" ON "documents" USING btree ("message_id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_entity_target" CHECK ((
        ("documents"."entity_type" = 'property' AND "documents"."property_id" = "documents"."entity_id" AND "documents"."unit_id" IS NULL AND "documents"."lease_id" IS NULL AND "documents"."tenant_id" IS NULL AND "documents"."work_order_id" IS NULL AND "documents"."message_id" IS NULL)
        OR ("documents"."entity_type" = 'unit' AND "documents"."unit_id" = "documents"."entity_id" AND "documents"."property_id" IS NULL AND "documents"."lease_id" IS NULL AND "documents"."tenant_id" IS NULL AND "documents"."work_order_id" IS NULL AND "documents"."message_id" IS NULL)
        OR ("documents"."entity_type" = 'lease' AND "documents"."lease_id" = "documents"."entity_id" AND "documents"."property_id" IS NULL AND "documents"."unit_id" IS NULL AND "documents"."tenant_id" IS NULL AND "documents"."work_order_id" IS NULL AND "documents"."message_id" IS NULL)
        OR ("documents"."entity_type" = 'tenant' AND "documents"."tenant_id" = "documents"."entity_id" AND "documents"."property_id" IS NULL AND "documents"."unit_id" IS NULL AND "documents"."lease_id" IS NULL AND "documents"."work_order_id" IS NULL AND "documents"."message_id" IS NULL)
        OR ("documents"."entity_type" = 'work_order' AND "documents"."work_order_id" = "documents"."entity_id" AND "documents"."property_id" IS NULL AND "documents"."unit_id" IS NULL AND "documents"."lease_id" IS NULL AND "documents"."tenant_id" IS NULL AND "documents"."message_id" IS NULL)
        OR ("documents"."entity_type" = 'message' AND "documents"."message_id" = "documents"."entity_id" AND "documents"."property_id" IS NULL AND "documents"."unit_id" IS NULL AND "documents"."lease_id" IS NULL AND "documents"."tenant_id" IS NULL AND "documents"."work_order_id" IS NULL)
      ));