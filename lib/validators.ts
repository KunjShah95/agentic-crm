import { z } from "zod"

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")

// ── Auth ──────────────────────────────────────────────────────────────────
export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: emailSchema,
  password: passwordSchema,
  workspaceName: z
    .string()
    .trim()
    .min(1, "Give your workspace a name")
    .max(80),
  inviteToken: z.string().optional(),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
})

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
})

// ── Contacts ──────────────────────────────────────────────────────────────
export const contactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().max(80).optional().default(""),
  email: emailSchema.optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  linkedinUrl: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  organizationId: z.string().optional().or(z.literal("")),
})

// ── Organizations ─────────────────────────────────────────────────────────
export const organizationSchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(160),
  domain: z.string().trim().toLowerCase().max(160).optional().or(z.literal("")),
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  size: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
})

// ── Deals ─────────────────────────────────────────────────────────────────
export const dealSchema = z.object({
  title: z.string().trim().min(1, "Deal title is required").max(160),
  stageId: z.string().min(1, "Pick a stage"),
  contactId: z.string().optional().or(z.literal("")),
  organizationId: z.string().optional().or(z.literal("")),
  value: z.coerce.number().min(0).optional().nullable(),
  currency: z.string().trim().max(8).default("USD"),
  probability: z.coerce.number().int().min(0).max(100).optional().nullable(),
  expectedCloseDate: z.coerce.date().optional().nullable(),
  ownerId: z.string().optional(),
})

export const pipelineStageSchema = z.object({
  name: z.string().trim().min(1, "Stage name is required").max(80),
  color: z.string().trim().max(16).default("#6366f1"),
})

export const reorderStagesSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
})

// ── Activities ────────────────────────────────────────────────────────────
export const activitySchema = z.object({
  type: z.enum(["NOTE", "EMAIL", "CALL", "MEETING", "TASK"]),
  contactId: z.string().optional().or(z.literal("")),
  dealId: z.string().optional().or(z.literal("")),
  body: z.string().trim().max(10_000).optional().default(""),
  scheduledAt: z.coerce.date().optional().nullable(),
  assigneeId: z.string().optional().or(z.literal("")),
})

export const completeTaskSchema = z.object({
  activityId: z.string().min(1),
  completed: z.boolean().default(true),
})

// ── Members / invites ─────────────────────────────────────────────────────
export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["ADMIN", "MEMBER"]),
})

export const updateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
})

export const removeMemberSchema = z.object({
  userId: z.string().min(1),
})

// ── Bulk actions ──────────────────────────────────────────────────────────
export const bulkTagSchema = z.object({
  contactIds: z.array(z.string().min(1)).min(1),
  tagIds: z.array(z.string().min(1)).min(1),
})

export const bulkAssignSchema = z.object({
  contactIds: z.array(z.string().min(1)).min(1),
  ownerId: z.string().min(1),
})

// ── Workspace ─────────────────────────────────────────────────────────────
export const workspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers and dashes")
    .max(48),
})

export * from "./validators/re"
