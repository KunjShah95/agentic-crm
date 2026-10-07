import { z } from "zod"

/**
 * Workspace pipeline preferences, stored under `Workspace.settingsJson.pipeline`.
 *
 * Only settings that something actually reads live here. The settings page used
 * to show a hold window, a "CLP demand letter automation" switch and an
 * auto-assign switch that saved nothing: the hold was hard-coded to 48 hours in
 * `holdUnit`, every ingested lead was round-robined regardless, and no
 * milestone-completion automation exists. Each field below now has a consumer:
 *
 *   holdDays    `modules/booking/actions.ts` → `holdUnit` default duration
 *   autoAssign  `modules/leadIngest/worker.ts` → whether a new lead gets an owner
 *
 * Plain module (not "use server") so both server actions and the worker can
 * import the parser without exposing it as an endpoint.
 */
export const pipelineSettingsSchema = z.object({
  holdDays: z.coerce.number().int().min(1, "At least 1 day.").max(30, "At most 30 days."),
  autoAssign: z.boolean(),
})

export type PipelineSettings = z.infer<typeof pipelineSettingsSchema>

/** 2 days matches the 48-hour hold `holdUnit` used before this was configurable. */
export const DEFAULT_PIPELINE_SETTINGS: PipelineSettings = {
  holdDays: 2,
  autoAssign: true,
}

/** Reads the pipeline block out of a raw `settingsJson`, falling back per field. */
export function readPipelineSettings(settingsJson: unknown): PipelineSettings {
  const raw = (settingsJson as Record<string, unknown> | null)?.pipeline
  const parsed = pipelineSettingsSchema.partial().safeParse(raw ?? {})
  return { ...DEFAULT_PIPELINE_SETTINGS, ...(parsed.success ? parsed.data : {}) }
}
