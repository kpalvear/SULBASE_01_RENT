import { count, eq } from "drizzle-orm";
import { properties, settings, units, vendors } from "../db/schema";
import type { AppDb } from "./db";

const DEFAULT_SETTINGS: Record<string, string> = {
  default_rent_due_day: "1",
  late_fee_amount: "50",
  late_fee_grace_days: "5",
  currency: "MXN",
  timezone: "America/Mexico_City",
  language: "es",
  date_format: "dd/MM/yyyy",
  area_unit: "m2",
};

const DEMO_PROPERTIES = [
  {
    name: "Oakwood Estate",
    type: "single_family" as const,
    address: "210 Oakwood Ln",
    city: "Austin",
    state: "TX",
    zip: "78704",
    color: "emerald",
  },
  {
    name: "Honeybee Hideaway",
    type: "single_family" as const,
    address: "88 Bramble Ct",
    city: "Austin",
    state: "TX",
    zip: "78704",
    color: "amber",
  },
  {
    name: "308 Mission Apartments",
    type: "multi_family" as const,
    address: "308 Mission St",
    city: "Austin",
    state: "TX",
    zip: "78702",
    color: "sky",
  },
];

const DEMO_UNITS: Array<{
  propertyIndex: number;
  name: string;
  bedrooms: string;
  bathrooms: string;
  sqft: number;
  marketRent: string;
  status: "vacant" | "occupied";
}> = [
  {
    propertyIndex: 0,
    name: "Main house",
    bedrooms: "3",
    bathrooms: "2",
    sqft: 1450,
    marketRent: "2300",
    status: "occupied",
  },
  {
    propertyIndex: 1,
    name: "Main house",
    bedrooms: "2",
    bathrooms: "1",
    sqft: 980,
    marketRent: "1700",
    status: "occupied",
  },
  {
    propertyIndex: 2,
    name: "Unit 1",
    bedrooms: "1",
    bathrooms: "1",
    sqft: 620,
    marketRent: "1450",
    status: "occupied",
  },
  {
    propertyIndex: 2,
    name: "Unit 2",
    bedrooms: "1",
    bathrooms: "1",
    sqft: 620,
    marketRent: "1450",
    status: "vacant",
  },
  {
    propertyIndex: 2,
    name: "Unit 3",
    bedrooms: "2",
    bathrooms: "1",
    sqft: 850,
    marketRent: "1850",
    status: "occupied",
  },
];

const DEMO_VENDORS = [
  {
    name: "Emerald Pool Service",
    category: "general" as const,
    phone: "512-555-0144",
    color: "emerald",
  },
  {
    name: "Hill Country Plumbing",
    category: "plumber" as const,
    phone: "512-555-0188",
    color: "sky",
  },
  {
    name: "Bright Spark Electric",
    category: "electrician" as const,
    phone: "512-555-0102",
    color: "amber",
  },
];

let seeded = false;

export async function ensureSeeded(db: AppDb, orgId: string): Promise<void> {
  if (seeded) return;
  seeded = true;
  try {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await db
        .insert(settings)
        .values({ organizationId: orgId, key, value })
        .onConflictDoNothing({
          target: [settings.organizationId, settings.key],
        });
    }

    const [propCount] = await db
      .select({ n: count() })
      .from(properties)
      .where(eq(properties.organizationId, orgId));

    if ((propCount?.n ?? 0) === 0) {
      const insertedProps = await db
        .insert(properties)
        .values(
          DEMO_PROPERTIES.map((p) => ({
            organizationId: orgId,
            name: p.name,
            type: p.type,
            address: p.address,
            city: p.city,
            state: p.state,
            zip: p.zip,
            color: p.color,
          })),
        )
        .returning({ id: properties.id });

      const [unitCount] = await db
        .select({ n: count() })
        .from(units)
        .where(eq(units.organizationId, orgId));

      if ((unitCount?.n ?? 0) === 0) {
        for (const u of DEMO_UNITS) {
          const propertyId = insertedProps[u.propertyIndex]?.id;
          if (!propertyId) continue;
          await db.insert(units).values({
            organizationId: orgId,
            propertyId,
            name: u.name,
            bedrooms: u.bedrooms,
            bathrooms: u.bathrooms,
            sqft: u.sqft,
            marketRent: u.marketRent,
            status: u.status,
          });
        }
      }
    }

    const [vendorCount] = await db
      .select({ n: count() })
      .from(vendors)
      .where(eq(vendors.organizationId, orgId));

    if ((vendorCount?.n ?? 0) === 0) {
      await db.insert(vendors).values(
        DEMO_VENDORS.map((v) => ({
          organizationId: orgId,
          name: v.name,
          category: v.category,
          phone: v.phone,
          color: v.color,
        })),
      );
    }
  } catch {
    seeded = false;
  }
}

export { DEFAULT_SETTINGS };
