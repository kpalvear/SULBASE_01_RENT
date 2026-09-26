CREATE TABLE "organization_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "membership_role" NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "organization_invitations_email_len" CHECK (char_length("organization_invitations"."email") BETWEEN 3 AND 254)
);
--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_org_invitations_pending_email" ON "organization_invitations" USING btree ("organization_id","email") WHERE "organization_invitations"."accepted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_org_invitations_email" ON "organization_invitations" USING btree ("email");