import { z } from "zod";

export const periodSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "period must be YYYY-MM");

export const uuidSchema = z.string().uuid();

export const rentChargeStatusSchema = z.enum([
  "open",
  "partial",
  "paid",
  "overdue",
  "waived",
]);

export const settingsPatchSchema = z.record(
  z.string().min(1),
  z.union([z.string(), z.number(), z.boolean()]),
);
