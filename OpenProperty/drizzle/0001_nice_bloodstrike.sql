CREATE TYPE "public"."document_entity_type" AS ENUM('property', 'unit', 'lease', 'tenant', 'work_order');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('image', 'deed', 'certificate', 'invoice', 'signed_lease', 'other');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" "document_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"property_id" uuid,
	"unit_id" uuid,
	"lease_id" uuid,
	"tenant_id" uuid,
	"work_order_id" uuid,
	"kind" "document_kind" NOT NULL,
	"r2_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by" uuid,
	"is_cover" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "documents_entity_target" CHECK ((
        ("documents"."entity_type" = 'property' AND "documents"."property_id" = "documents"."entity_id" AND "documents"."unit_id" IS NULL AND "documents"."lease_id" IS NULL AND "documents"."tenant_id" IS NULL AND "documents"."work_order_id" IS NULL)
        OR ("documents"."entity_type" = 'unit' AND "documents"."unit_id" = "documents"."entity_id" AND "documents"."property_id" IS NULL AND "documents"."lease_id" IS NULL AND "documents"."tenant_id" IS NULL AND "documents"."work_order_id" IS NULL)
        OR ("documents"."entity_type" = 'lease' AND "documents"."lease_id" = "documents"."entity_id" AND "documents"."property_id" IS NULL AND "documents"."unit_id" IS NULL AND "documents"."tenant_id" IS NULL AND "documents"."work_order_id" IS NULL)
        OR ("documents"."entity_type" = 'tenant' AND "documents"."tenant_id" = "documents"."entity_id" AND "documents"."property_id" IS NULL AND "documents"."unit_id" IS NULL AND "documents"."lease_id" IS NULL AND "documents"."work_order_id" IS NULL)
        OR ("documents"."entity_type" = 'work_order' AND "documents"."work_order_id" = "documents"."entity_id" AND "documents"."property_id" IS NULL AND "documents"."unit_id" IS NULL AND "documents"."lease_id" IS NULL AND "documents"."tenant_id" IS NULL)
      )),
	CONSTRAINT "documents_cover_is_image" CHECK (("documents"."is_cover" = false OR "documents"."kind" = 'image')),
	CONSTRAINT "documents_size_bytes" CHECK (("documents"."size_bytes" > 0 AND "documents"."size_bytes" <= 10485760))
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_property_id_organization_id_properties_id_organization_id_fk" FOREIGN KEY ("property_id","organization_id") REFERENCES "public"."properties"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_unit_id_organization_id_units_id_organization_id_fk" FOREIGN KEY ("unit_id","organization_id") REFERENCES "public"."units"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_lease_id_organization_id_leases_id_organization_id_fk" FOREIGN KEY ("lease_id","organization_id") REFERENCES "public"."leases"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_organization_id_tenants_id_organization_id_fk" FOREIGN KEY ("tenant_id","organization_id") REFERENCES "public"."tenants"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_work_order_id_organization_id_work_orders_id_organization_id_fk" FOREIGN KEY ("work_order_id","organization_id") REFERENCES "public"."work_orders"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_documents_org" ON "documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_documents_entity" ON "documents" USING btree ("organization_id","entity_type","entity_id") WHERE "documents"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_documents_property_id" ON "documents" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "idx_documents_unit_id" ON "documents" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_documents_lease_id" ON "documents" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "idx_documents_tenant_id" ON "documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_documents_work_order_id" ON "documents" USING btree ("work_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_documents_r2_key" ON "documents" USING btree ("r2_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_documents_one_cover" ON "documents" USING btree ("organization_id","entity_type","entity_id") WHERE "documents"."is_cover" = true AND "documents"."deleted_at" IS NULL;