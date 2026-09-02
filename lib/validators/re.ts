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
export const webhookPayloadSchema = z.object({ source: z.string().min(1), externalId: z.string().min(1), payload: z.record(z.string(), z.any()) })
export const whatsappInboundSchema = z.object({ from: z.string().min(1), text: z.string().optional(), timestamp: z.coerce.date().optional() })

export const paymentPlanSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  milestones: z
    .array(z.object({ label: z.string().trim().min(1).max(80), pct: z.coerce.number().min(0).max(100), dueTrigger: z.string().trim().max(40).optional(), daysAfter: z.coerce.number().int().min(0).optional() }))
    .min(1)
    .optional(),
})
export const bookingSchema = z.object({
  dealId: z.string().min(1),
  unitId: z.string().min(1),
  paymentPlanId: z.string().optional().or(z.literal("")),
  kyc: z.object({ pan: z.string().trim().max(20).optional(), aadhaarLast4: z.string().trim().max(4).optional(), bankName: z.string().trim().max(120).optional(), bankAccountLast4: z.string().trim().max(4).optional() }).optional(),
})
export const siteVisitSchema = z.object({
  leadId: z.string().min(1),
  unitId: z.string().optional().or(z.literal("")),
  dealId: z.string().optional().or(z.literal("")),
  scheduledAt: z.coerce.date(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
})
export const checkInSchema = z.object({
  siteVisitId: z.string().min(1),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  outcome: z.string().trim().max(80).optional().or(z.literal("")),
})
export const brokerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  reraNo: z.string().trim().max(80).optional().or(z.literal("")),
  brokerage: z.coerce.number().min(0).max(100).optional().nullable(),
  userId: z.string().optional().or(z.literal("")),
})
export const commissionSchema = z
  .object({
    dealId: z.string().min(1),
    brokerId: z.string().min(1),
    pct: z.coerce.number().min(0).max(100).optional().nullable(),
    amount: z.coerce.number().min(0).optional().nullable(),
  })
  .refine((v) => v.pct != null || v.amount != null, { message: "Provide pct or amount" })
