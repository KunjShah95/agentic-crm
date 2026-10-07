import { describe, it, expect } from "vitest"
import { DEFAULT_PIPELINE_SETTINGS, readPipelineSettings } from "@/modules/workspace/pipeline-settings"

describe("readPipelineSettings", () => {
  it("defaults when nothing is stored", () => {
    expect(readPipelineSettings(null)).toEqual(DEFAULT_PIPELINE_SETTINGS)
    expect(readPipelineSettings({ ingest: { secretHash: "x" } })).toEqual(DEFAULT_PIPELINE_SETTINGS)
  })

  it("reads stored values and falls back per field", () => {
    expect(readPipelineSettings({ pipeline: { holdDays: 5, autoAssign: false } })).toEqual({
      holdDays: 5,
      autoAssign: false,
    })
    expect(readPipelineSettings({ pipeline: { autoAssign: false } })).toEqual({ holdDays: 2, autoAssign: false })
  })

  it("ignores invalid stored values", () => {
    expect(readPipelineSettings({ pipeline: { holdDays: 999, autoAssign: "yes" } })).toEqual(DEFAULT_PIPELINE_SETTINGS)
  })
})
