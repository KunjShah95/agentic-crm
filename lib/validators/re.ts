import { z } from "zod"
export const projectSchema = z.object({
  name: z.string().trim().min(1).max(160),
  reraNo: z.string().trim().max(80).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  city: z.string().trim().max(80).default("Ahmedabad"),
  type: z.enum(["RESIDENTIAL", "COMMERCIAL", "PLOT"]).default("RESIDENTIAL"),
})
export const towerSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  floors: z.coerce.number().int().min(1).max(100).default(10),
})
export const floorSchema = z.object({
  towerId: z.string().min(1),
  number: z.coerce.number().int().min(0).max(200),
})
export const unitSchema = z.object({
  projectId: z.string().min(1),
  floorId: z.string().optional().or(z.literal("")),
  unitNo: z.string().trim().min(1).max(40),
  config: z.enum(["BHK1", "BHK2", "BHK3", "BHK4", "VILLA", "PLOT", "SHOP", "OFFICE"]).default("BHK2"),
  area: z.coerce.number().min(0).optional().nullable(),
  carpetArea: z.coerce.number().min(0).optional().nullable(),
  builtUp: z.coerce.number().min(0).optional().nullable(),
  facing: z.string().trim().max(20).optional().or(z.literal("")),
  price: z.coerce.number().min(0).optional().nullable(),
  status: z.enum(["AVAILABLE", "HOLD", "BOOKED", "SOLD"]).default("AVAILABLE"),
})
export const costSheetSchema = z.object({
  unitId: z.string().min(1),
  dealId: z.string().optional().or(z.literal("")),
  basePrice: z.coerce.number().min(0),
  gst: z.coerce.number().min(0).default(0),
  stampDuty: z.coerce.number().min(0).default(0),
  otherCharges: z.record(z.string(), z.number()).optional(),
})
export const documentTemplateSchema = z.object({
  kind: z.enum(["DEMAND_LETTER", "ALLOTMENT", "BOOKING_FORM", "RECEIPT", "POSSESSION"]),
  name: z.string().trim().min(1).max(160),
  bodyHtml: z.string().trim().min(1).max(50000),
  reraAligned: z.boolean().default(true),
})
export const updateUnitStatusSchema = z.object({
  unitId: z.string().min(1),
  status: z.enum(["AVAILABLE", "HOLD", "BOOKED", "SOLD"]),
  holdUntil: z.coerce.date().optional().nullable(),
})
