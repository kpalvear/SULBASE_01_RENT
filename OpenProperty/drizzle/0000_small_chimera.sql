CREATE TYPE "public"."application_status" AS ENUM('new', 'screening', 'approved', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."lease_status" AS ENUM('upcoming', 'active', 'ended', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'manager', 'staff', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'check', 'ach', 'credit', 'other');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('single_family', 'multi_family', 'condo', 'townhouse', 'commercial');--> statement-breakpoint
CREATE TYPE "public"."rent_charge_status" AS ENUM('open', 'partial', 'paid', 'overdue', 'waived');--> statement-breakpoint
CREATE TYPE "public"."unit_status" AS ENUM('vacant', 'occupied', 'turnover', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."vendor_category" AS ENUM('plumber', 'electrician', 'hvac', 'handyman', 'cleaning', 'landscaping', 'general');--> statement-breakpoint
CREATE TYPE "public"."work_order_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('open', 'assigned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"unit_id" uuid,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"monthly_income" numeric(12, 2),
	"employer" text,
	"desired_move_in" date,
	"status" "application_status" DEFAULT 'new' NOT NULL,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lease_tenants" (
	"organization_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	CONSTRAINT "lease_tenants_lease_id_tenant_id_pk" PRIMARY KEY("lease_id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"primary_tenant_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"monthly_rent" numeric(12, 2) DEFAULT '0' NOT NULL,
	"deposit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"rent_due_day" integer DEFAULT 1 NOT NULL,
	"late_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "lease_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "membership_role" DEFAULT 'staff' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"charge_id" uuid NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"method" "payment_method" DEFAULT 'cash' NOT NULL,
	"reference" text,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "property_type" DEFAULT 'single_family' NOT NULL,
	"address" text,
	"city" text,
	"state" text,
	"zip" text,
	"year_built" integer,
	"notes" text,
	"color" text DEFAULT 'sky' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rent_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"period" text NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "rent_charge_status" DEFAULT 'open' NOT NULL,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"organization_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_organization_id_key_pk" PRIMARY KEY("organization_id","key")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"date_of_birth" date,
	"emergency_contact" text,
	"employer" text,
	"monthly_income" numeric(12, 2),
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text NOT NULL,
	"bedrooms" numeric(4, 1) DEFAULT '1' NOT NULL,
	"bathrooms" numeric(4, 1) DEFAULT '1' NOT NULL,
	"sqft" integer,
	"market_rent" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "unit_status" DEFAULT 'vacant' NOT NULL,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" "vendor_category" DEFAULT 'general' NOT NULL,
	"phone" text,
	"email" text,
	"notes" text,
	"color" text DEFAULT 'slate' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid,
	"unit_id" uuid,
	"tenant_id" uuid,
	"vendor_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"priority" "work_order_priority" DEFAULT 'normal' NOT NULL,
	"status" "work_order_status" DEFAULT 'open' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cost" numeric(12, 2),
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_applications_id_org" ON "applications" USING btree ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_leases_id_org" ON "leases" USING btree ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payments_id_org" ON "payments" USING btree ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_properties_id_org" ON "properties" USING btree ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rent_charges_id_org" ON "rent_charges" USING btree ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenants_id_org" ON "tenants" USING btree ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_units_id_org" ON "units" USING btree ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_vendors_id_org" ON "vendors" USING btree ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_work_orders_id_org" ON "work_orders" USING btree ("id","organization_id");--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_unit_id_organization_id_units_id_organization_id_fk" FOREIGN KEY ("unit_id","organization_id") REFERENCES "public"."units"("id","organization_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_tenants" ADD CONSTRAINT "lease_tenants_lease_id_organization_id_leases_id_organization_id_fk" FOREIGN KEY ("lease_id","organization_id") REFERENCES "public"."leases"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_tenants" ADD CONSTRAINT "lease_tenants_tenant_id_organization_id_tenants_id_organization_id_fk" FOREIGN KEY ("tenant_id","organization_id") REFERENCES "public"."tenants"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_unit_id_organization_id_units_id_organization_id_fk" FOREIGN KEY ("unit_id","organization_id") REFERENCES "public"."units"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_primary_tenant_id_organization_id_tenants_id_organization_id_fk" FOREIGN KEY ("primary_tenant_id","organization_id") REFERENCES "public"."tenants"("id","organization_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_charge_id_organization_id_rent_charges_id_organization_id_fk" FOREIGN KEY ("charge_id","organization_id") REFERENCES "public"."rent_charges"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_charges" ADD CONSTRAINT "rent_charges_lease_id_organization_id_leases_id_organization_id_fk" FOREIGN KEY ("lease_id","organization_id") REFERENCES "public"."leases"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_property_id_organization_id_properties_id_organization_id_fk" FOREIGN KEY ("property_id","organization_id") REFERENCES "public"."properties"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_property_id_organization_id_properties_id_organization_id_fk" FOREIGN KEY ("property_id","organization_id") REFERENCES "public"."properties"("id","organization_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_unit_id_organization_id_units_id_organization_id_fk" FOREIGN KEY ("unit_id","organization_id") REFERENCES "public"."units"("id","organization_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenant_id_organization_id_tenants_id_organization_id_fk" FOREIGN KEY ("tenant_id","organization_id") REFERENCES "public"."tenants"("id","organization_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vendor_id_organization_id_vendors_id_organization_id_fk" FOREIGN KEY ("vendor_id","organization_id") REFERENCES "public"."vendors"("id","organization_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_applications_org_status" ON "applications" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_lease_tenants_org" ON "lease_tenants" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_leases_org" ON "leases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_leases_unit" ON "leases" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_leases_tenant" ON "leases" USING btree ("primary_tenant_id");--> statement-breakpoint
CREATE INDEX "idx_leases_org_status" ON "leases" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_memberships_user" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_payments_org" ON "payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_payments_charge" ON "payments" USING btree ("charge_id");--> statement-breakpoint
CREATE INDEX "idx_properties_org" ON "properties" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_charges_lease_period" ON "rent_charges" USING btree ("lease_id","period");--> statement-breakpoint
CREATE INDEX "idx_charges_org_due" ON "rent_charges" USING btree ("organization_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_charges_org_status" ON "rent_charges" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_settings_org" ON "settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_tenants_org" ON "tenants" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_tenants_org_name" ON "tenants" USING btree ("organization_id","last_name","first_name");--> statement-breakpoint
CREATE INDEX "idx_units_org" ON "units" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_units_property" ON "units" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "idx_units_org_status" ON "units" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_vendors_org" ON "vendors" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_wo_org_status" ON "work_orders" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_wo_org_property" ON "work_orders" USING btree ("organization_id","property_id");--> statement-breakpoint
CREATE INDEX "idx_wo_org_unit" ON "work_orders" USING btree ("organization_id","unit_id");