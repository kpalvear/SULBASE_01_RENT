import { relations } from "drizzle-orm";
import {
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "manager",
  "staff",
  "viewer",
]);

export const propertyTypeEnum = pgEnum("property_type", [
  "single_family",
  "multi_family",
  "condo",
  "townhouse",
  "commercial",
]);

export const unitStatusEnum = pgEnum("unit_status", [
  "vacant",
  "occupied",
  "turnover",
  "unavailable",
]);

export const leaseStatusEnum = pgEnum("lease_status", [
  "upcoming",
  "active",
  "ended",
  "cancelled",
]);

export const rentChargeStatusEnum = pgEnum("rent_charge_status", [
  "open",
  "partial",
  "paid",
  "overdue",
  "waived",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "check",
  "ach",
  "credit",
  "other",
]);

export const vendorCategoryEnum = pgEnum("vendor_category", [
  "plumber",
  "electrician",
  "hvac",
  "handyman",
  "cleaning",
  "landscaping",
  "general",
]);

export const workOrderPriorityEnum = pgEnum("work_order_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const workOrderStatusEnum = pgEnum("work_order_status", [
  "open",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "new",
  "screening",
  "approved",
  "declined",
  "withdrawn",
]);

export type JsonObject = Record<string, unknown>;

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  metadata: jsonb("metadata").$type<JsonObject>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: membershipRoleEnum("role").notNull().default("staff"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    index("idx_memberships_user").on(table.userId),
  ],
);

export const settings = pgTable(
  "settings",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.key] }),
    index("idx_settings_org").on(table.organizationId),
  ],
);

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: propertyTypeEnum("type").notNull().default("single_family"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    zip: text("zip"),
    yearBuilt: integer("year_built"),
    notes: text("notes"),
    color: text("color").notNull().default("sky"),
    metadata: jsonb("metadata").$type<JsonObject>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_properties_org").on(table.organizationId),
    uniqueIndex("uq_properties_id_org").on(table.id, table.organizationId),
  ],
);

export const units = pgTable(
  "units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    propertyId: uuid("property_id").notNull(),
    name: text("name").notNull(),
    bedrooms: numeric("bedrooms", { precision: 4, scale: 1 })
      .notNull()
      .default("1"),
    bathrooms: numeric("bathrooms", { precision: 4, scale: 1 })
      .notNull()
      .default("1"),
    sqft: integer("sqft"),
    marketRent: numeric("market_rent", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    status: unitStatusEnum("status").notNull().default("vacant"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<JsonObject>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.propertyId, table.organizationId],
      foreignColumns: [properties.id, properties.organizationId],
    }).onDelete("cascade"),
    index("idx_units_org").on(table.organizationId),
    index("idx_units_property").on(table.propertyId),
    index("idx_units_org_status").on(table.organizationId, table.status),
    uniqueIndex("uq_units_id_org").on(table.id, table.organizationId),
  ],
);

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    dateOfBirth: date("date_of_birth"),
    emergencyContact: text("emergency_contact"),
    employer: text("employer"),
    monthlyIncome: numeric("monthly_income", { precision: 12, scale: 2 }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<JsonObject>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_tenants_org").on(table.organizationId),
    index("idx_tenants_org_name").on(
      table.organizationId,
      table.lastName,
      table.firstName,
    ),
    uniqueIndex("uq_tenants_id_org").on(table.id, table.organizationId),
  ],
);

export const leases = pgTable(
  "leases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    unitId: uuid("unit_id").notNull(),
    primaryTenantId: uuid("primary_tenant_id"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    monthlyRent: numeric("monthly_rent", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    deposit: numeric("deposit", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    rentDueDay: integer("rent_due_day").notNull().default(1),
    lateFee: numeric("late_fee", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    status: leaseStatusEnum("status").notNull().default("active"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<JsonObject>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.unitId, table.organizationId],
      foreignColumns: [units.id, units.organizationId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.primaryTenantId, table.organizationId],
      foreignColumns: [tenants.id, tenants.organizationId],
    }).onDelete("set null"),
    index("idx_leases_org").on(table.organizationId),
    index("idx_leases_unit").on(table.unitId),
    index("idx_leases_tenant").on(table.primaryTenantId),
    index("idx_leases_org_status").on(table.organizationId, table.status),
    uniqueIndex("uq_leases_id_org").on(table.id, table.organizationId),
  ],
);

export const leaseTenants = pgTable(
  "lease_tenants",
  {
    organizationId: uuid("organization_id").notNull(),
    leaseId: uuid("lease_id").notNull(),
    tenantId: uuid("tenant_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.leaseId, table.tenantId] }),
    foreignKey({
      columns: [table.leaseId, table.organizationId],
      foreignColumns: [leases.id, leases.organizationId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenantId, table.organizationId],
      foreignColumns: [tenants.id, tenants.organizationId],
    }).onDelete("cascade"),
    index("idx_lease_tenants_org").on(table.organizationId),
  ],
);

export const rentCharges = pgTable(
  "rent_charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    leaseId: uuid("lease_id").notNull(),
    period: text("period").notNull(),
    dueDate: date("due_date").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    status: rentChargeStatusEnum("status").notNull().default("open"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<JsonObject>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.leaseId, table.organizationId],
      foreignColumns: [leases.id, leases.organizationId],
    }).onDelete("cascade"),
    uniqueIndex("idx_charges_lease_period").on(table.leaseId, table.period),
    index("idx_charges_org_due").on(table.organizationId, table.dueDate),
    index("idx_charges_org_status").on(table.organizationId, table.status),
    uniqueIndex("uq_rent_charges_id_org").on(table.id, table.organizationId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    chargeId: uuid("charge_id").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    amount: numeric("amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    method: paymentMethodEnum("method").notNull().default("cash"),
    reference: text("reference"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<JsonObject>().notNull().default({}),
  },
  (table) => [
    foreignKey({
      columns: [table.chargeId, table.organizationId],
      foreignColumns: [rentCharges.id, rentCharges.organizationId],
    }).onDelete("cascade"),
    index("idx_payments_org").on(table.organizationId),
    index("idx_payments_charge").on(table.chargeId),
    uniqueIndex("uq_payments_id_org").on(table.id, table.organizationId),
  ],
);

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: vendorCategoryEnum("category").notNull().default("general"),
    phone: text("phone"),
    email: text("email"),
    notes: text("notes"),
    color: text("color").notNull().default("slate"),
    metadata: jsonb("metadata").$type<JsonObject>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_vendors_org").on(table.organizationId),
    uniqueIndex("uq_vendors_id_org").on(table.id, table.organizationId),
  ],
);

export const workOrders = pgTable(
  "work_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id"),
    unitId: uuid("unit_id"),
    tenantId: uuid("tenant_id"),
    vendorId: uuid("vendor_id"),
    title: text("title").notNull(),
    description: text("description"),
    priority: workOrderPriorityEnum("priority").notNull().default("normal"),
    status: workOrderStatusEnum("status").notNull().default("open"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cost: numeric("cost", { precision: 12, scale: 2 }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<JsonObject>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.propertyId, table.organizationId],
      foreignColumns: [properties.id, properties.organizationId],
    }).onDelete("set null"),
    foreignKey({
      columns: [table.unitId, table.organizationId],
      foreignColumns: [units.id, units.organizationId],
    }).onDelete("set null"),
    foreignKey({
      columns: [table.tenantId, table.organizationId],
      foreignColumns: [tenants.id, tenants.organizationId],
    }).onDelete("set null"),
    foreignKey({
      columns: [table.vendorId, table.organizationId],
      foreignColumns: [vendors.id, vendors.organizationId],
    }).onDelete("set null"),
    index("idx_wo_org_status").on(table.organizationId, table.status),
    index("idx_wo_org_property").on(table.organizationId, table.propertyId),
    index("idx_wo_org_unit").on(table.organizationId, table.unitId),
    uniqueIndex("uq_work_orders_id_org").on(table.id, table.organizationId),
  ],
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    monthlyIncome: numeric("monthly_income", { precision: 12, scale: 2 }),
    employer: text("employer"),
    desiredMoveIn: date("desired_move_in"),
    status: applicationStatusEnum("status").notNull().default("new"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<JsonObject>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.unitId, table.organizationId],
      foreignColumns: [units.id, units.organizationId],
    }).onDelete("set null"),
    index("idx_applications_org_status").on(table.organizationId, table.status),
    uniqueIndex("uq_applications_id_org").on(table.id, table.organizationId),
  ],
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  properties: many(properties),
  tenants: many(tenants),
  vendors: many(vendors),
  workOrders: many(workOrders),
  applications: many(applications),
  settings: many(settings),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [properties.organizationId],
    references: [organizations.id],
  }),
  units: many(units),
}));

export const unitsRelations = relations(units, ({ one, many }) => ({
  property: one(properties, {
    fields: [units.propertyId, units.organizationId],
    references: [properties.id, properties.organizationId],
  }),
  leases: many(leases),
}));

export const leasesRelations = relations(leases, ({ one, many }) => ({
  unit: one(units, {
    fields: [leases.unitId, leases.organizationId],
    references: [units.id, units.organizationId],
  }),
  primaryTenant: one(tenants, {
    fields: [leases.primaryTenantId, leases.organizationId],
    references: [tenants.id, tenants.organizationId],
  }),
  rentCharges: many(rentCharges),
  leaseTenants: many(leaseTenants),
}));

export const rentChargesRelations = relations(rentCharges, ({ one, many }) => ({
  lease: one(leases, {
    fields: [rentCharges.leaseId, rentCharges.organizationId],
    references: [leases.id, leases.organizationId],
  }),
  payments: many(payments),
}));
